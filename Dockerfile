# Stock Peak — Single Container
# Bundles: PostgreSQL 16 + Next.js + Python notifier + APScheduler
# supervisord manages all three processes.
#
# BUILD:
#   # Build Next.js first (if not already built):
#   cd app && npm run build && cd ..
#   docker build -t stockpeak .
#
# RUN:
#   docker run -d -p 3000:3000 \
#     -v stockpeak-pgdata:/var/lib/postgresql/data \
#     -v stockpeak-logs:/var/log/stockpeak \
#     --env-file .env \
#     stockpeak
#
# Or with compose:
#   docker compose up --build -d

# Use cached postgres:16 as base (Debian Bookworm — has apt, creates postgres user)
FROM postgres:16

# ── Node.js 22 via nodesource ─────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl gnupg ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# ── Python 3.12 + build tools ────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv \
    python3-dev gcc libpq-dev \
    supervisor \
    procps \
    tzdata \
    && rm -rf /var/lib/apt/lists/*

# ── Timezone ──────────────────────────────────────────────────────────────────
ENV TZ=Asia/Dhaka
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# ── Python dependencies (venv avoids system package conflicts) ────────────────
COPY scripts/requirements-notifier.txt /tmp/requirements.txt
RUN python3 -m venv /opt/venv && \
    /opt/venv/bin/pip install --no-cache-dir -r /tmp/requirements.txt

ENV PATH="/opt/venv/bin:$PATH"

# ── Next.js standalone (pre-built — run `cd app && npm run build` first) ──────
# Note: Claude Code CLI removed 2026-04-15. Python picks generator uses OpenRouter directly.
WORKDIR /app
COPY app/.next/standalone ./
COPY app/.next/static ./.next/static
COPY app/public ./public

# ── Python scripts ────────────────────────────────────────────────────────────
COPY scripts/ /app/scripts/

# ── SQL schema files (applied on first boot) ──────────────────────────────────
RUN mkdir -p /app/schema
COPY app/schema.sql /app/schema/01-schema.sql
COPY app/schema-portfolio.sql /app/schema/02-schema-portfolio.sql
COPY app/schema-broker-agent.sql /app/schema/03-schema-broker-agent.sql
COPY app/schema-notifications.sql /app/schema/04-schema-notifications.sql
COPY app/schema-m1.sql /app/schema/05-schema-m1.sql

# ── Docker helpers ────────────────────────────────────────────────────────────
COPY docker/supervisord.conf /etc/supervisor/conf.d/stockpeak.conf
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# ── Directories ───────────────────────────────────────────────────────────────
RUN mkdir -p /var/log/stockpeak /var/log/supervisor /run && \
    chmod 777 /var/log/stockpeak

# postgres:16 already has postgres user + /var/lib/postgresql — just set permissions
RUN chown -R postgres:postgres /var/lib/postgresql/ && \
    chmod 700 /var/lib/postgresql/

EXPOSE 3000

VOLUME ["/var/lib/postgresql/data", "/var/log/stockpeak"]

ENTRYPOINT ["/entrypoint.sh"]
