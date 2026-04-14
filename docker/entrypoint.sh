#!/bin/bash
set -e

PGDATA="/var/lib/postgresql/data"
DB_NAME="stockpeak"
DB_USER="stockpeak"
DB_PASS="${STOCKPEAK_DB_PASSWORD:-stockpeak}"
PG_BIN="/usr/lib/postgresql/16/bin"
SCHEMA_DIR="/app/schema"
MARKER="$PGDATA/.stockpeak_initialized"

log() { echo "[entrypoint] $*"; }

# ── 1. Initialize PostgreSQL cluster ─────────────────────────────────────────
if [ ! -f "$PGDATA/PG_VERSION" ]; then
    log "Initializing PostgreSQL cluster..."
    su -s /bin/bash postgres -c "$PG_BIN/initdb -D $PGDATA --auth-host=md5 --auth-local=trust -U postgres"
    log "Cluster initialized."
fi

# Allow TCP connections from localhost with md5
cat > "$PGDATA/pg_hba.conf" <<HBA
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all             postgres                                peer
local   all             all                                     trust
host    all             all             127.0.0.1/32            md5
host    all             all             ::1/128                 md5
HBA

# Set listen_addresses
grep -q "^listen_addresses" "$PGDATA/postgresql.conf" \
    && sed -i "s/^listen_addresses.*/listen_addresses = 'localhost'/" "$PGDATA/postgresql.conf" \
    || echo "listen_addresses = 'localhost'" >> "$PGDATA/postgresql.conf"

chown postgres:postgres "$PGDATA/pg_hba.conf"

# ── 2. Start PostgreSQL temporarily for schema setup ─────────────────────────
log "Starting PostgreSQL for initialization..."
su -s /bin/bash postgres -c "$PG_BIN/pg_ctl -D $PGDATA -l /tmp/postgres-init.log start -w -t 30"

# ── 3. Create DB user and database (idempotent) ───────────────────────────────
log "Ensuring database user and database exist..."
su -s /bin/bash postgres -c "psql -c \"SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'\" | grep -q 1 \
    || psql -c \"CREATE ROLE $DB_USER WITH LOGIN PASSWORD '$DB_PASS';\""

su -s /bin/bash postgres -c "psql -tc \"SELECT 1 FROM pg_database WHERE datname='$DB_NAME'\" | grep -q 1 \
    || psql -c \"CREATE DATABASE $DB_NAME OWNER $DB_USER;\""

# ── 4. Apply schema files (errors on existing tables are non-fatal) ───────────
if [ ! -f "$MARKER" ]; then
    log "Applying schema migrations..."
    for f in $(ls "$SCHEMA_DIR"/*.sql | sort); do
        log "  applying $f..."
        su -s /bin/bash postgres -c "psql -d $DB_NAME -f $f" 2>&1 || true
    done
    touch "$MARKER"
    log "Schema applied."
else
    log "Schema already applied, skipping (delete $MARKER to re-run migrations)."
fi

# ── 4b. Grant table privileges to app user ───────────────────────────────────
# Schema files are applied as postgres superuser, so tables are owned by postgres.
# The app connects as $DB_USER — grant it full access to all tables and sequences.
log "Granting table privileges to $DB_USER..."
su -s /bin/bash postgres -c "psql -d $DB_NAME -c \"
  GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;
  GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $DB_USER;
\"" 2>&1 || true

# ── 5. Stop temp PostgreSQL ───────────────────────────────────────────────────
log "Stopping init PostgreSQL..."
su -s /bin/bash postgres -c "$PG_BIN/pg_ctl -D $PGDATA stop -w -t 30" || true

# ── 6. Set internal DATABASE_URL if not provided ─────────────────────────────
if [ -z "$DATABASE_URL" ]; then
    export DATABASE_URL="postgresql://$DB_USER:$DB_PASS@127.0.0.1:5432/$DB_NAME"
    log "Using internal DATABASE_URL: postgresql://$DB_USER:****@127.0.0.1:5432/$DB_NAME"
else
    log "Using external DATABASE_URL from environment."
fi

# ── 7. API key wiring ─────────────────────────────────────────────────────────
# OpenRouter is the default LLM backend. OPEN_ROUTER_KEY is the expected var name.
# Also accept OPENROUTER_API_KEY as an alias.
if [ -n "$OPEN_ROUTER_KEY" ] && [ -z "$OPENROUTER_API_KEY" ]; then
    export OPENROUTER_API_KEY="$OPEN_ROUTER_KEY"
    log "OPENROUTER_API_KEY set from OPEN_ROUTER_KEY."
elif [ -n "$OPENROUTER_API_KEY" ] && [ -z "$OPEN_ROUTER_KEY" ]; then
    export OPEN_ROUTER_KEY="$OPENROUTER_API_KEY"
    log "OPEN_ROUTER_KEY set from OPENROUTER_API_KEY."
fi

# Claude Code CLI uses ANTHROPIC_API_KEY. Accept CLAUDE_API_KEY as alias.
if [ -n "$CLAUDE_API_KEY" ] && [ -z "$ANTHROPIC_API_KEY" ]; then
    export ANTHROPIC_API_KEY="$CLAUDE_API_KEY"
    log "ANTHROPIC_API_KEY set from CLAUDE_API_KEY (for Claude Code CLI)."
elif [ -n "$ANTHROPIC_API_KEY" ] && [ -z "$CLAUDE_API_KEY" ]; then
    export CLAUDE_API_KEY="$ANTHROPIC_API_KEY"
    log "CLAUDE_API_KEY set from ANTHROPIC_API_KEY."
fi

# Auto-select backend based on which key is present (explicit PICKS_BACKEND wins)
if [ -z "$PICKS_BACKEND" ]; then
    if [ -n "$OPEN_ROUTER_KEY" ]; then
        export PICKS_BACKEND="openrouter"
        log "PICKS_BACKEND=openrouter (auto-detected from OPEN_ROUTER_KEY)."
    elif [ -n "$ANTHROPIC_API_KEY" ]; then
        export PICKS_BACKEND="claude-code"
        log "PICKS_BACKEND=claude-code (auto-detected from ANTHROPIC_API_KEY)."
    else
        log "WARNING: No LLM API key set. Set OPEN_ROUTER_KEY or ANTHROPIC_API_KEY."
    fi
fi

# ── 7b. Auto-generate NEXTAUTH_SECRET if not set ──────────────────────────────
if [ -z "$NEXTAUTH_SECRET" ]; then
    export NEXTAUTH_SECRET=$(openssl rand -base64 32)
    log "NEXTAUTH_SECRET auto-generated (set NEXTAUTH_SECRET in .env to pin it)."
fi

# Write env for child processes (sourced by supervisord program wrappers)
cat > /run/stockpeak.env <<ENV
DATABASE_URL=$DATABASE_URL
OPEN_ROUTER_KEY=${OPEN_ROUTER_KEY:-}
OPENROUTER_API_KEY=${OPENROUTER_API_KEY:-}
OPENROUTER_MODEL=${OPENROUTER_MODEL:-anthropic/claude-sonnet-4.6}
CLAUDE_API_KEY=${CLAUDE_API_KEY:-}
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
CLAUDE_MODEL=${CLAUDE_MODEL:-claude-sonnet-4-6}
PICKS_BACKEND=${PICKS_BACKEND:-openrouter}
NEXTAUTH_SECRET=$NEXTAUTH_SECRET
NEXTAUTH_URL=${NEXTAUTH_URL:-http://localhost:3000}
GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID:-}
GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET:-}
TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN:-}
TELEGRAM_CHANNEL_ID=${TELEGRAM_CHANNEL_ID:-}
OWNER_TELEGRAM_ID=${OWNER_TELEGRAM_ID:-}
RESEND_API_KEY=${RESEND_API_KEY:-}
MULTI_AGENT=${MULTI_AGENT:-0}
FEEDBACK_MIN_SAMPLE=${FEEDBACK_MIN_SAMPLE:-30}
STOCKPEAK_LOG_DIR=${STOCKPEAK_LOG_DIR:-/var/log/stockpeak}
PYTHON_BIN=/opt/venv/bin/python3
SCRIPTS_DIR=/app/scripts
TZ=Asia/Dhaka
ENV

log "Starting supervisord..."
exec /usr/bin/supervisord -c /etc/supervisor/supervisord.conf --nodaemon
