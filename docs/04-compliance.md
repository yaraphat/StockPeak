# StockNow — Compliance Implementation

## Overview

StockNow operates under three overlapping regulatory frameworks:

| Framework | Authority | Applies To |
|-----------|-----------|------------|
| BSEC Research Analysis Rules 2013 + Nov 2024 circular | Bangladesh Securities and Exchange Commission | AI predictions, research reports, analyst registration |
| Personal Data Protection Ordinance 2025 (PDPO) | National Data Governance Authority (NDGA) | All user PII, consent management, data localization |
| Bangladesh Bank Cloud Computing Guidelines (Circular 05/2023) | Bangladesh Bank | If payment integration or banking features are added |

---

## 1. BSEC Registration (Critical — Start Immediately)

### The Core Requirement

Only 5 entity types may publish AI stock predictions publicly in Bangladesh. A November 2024 BSEC circular explicitly confirmed that unregistered entities — including AI systems — cannot publicly share stock forecasts.

Eligible entity types:
1. Broker-dealers
2. Merchant banks
3. Asset management companies
4. Investment advisers
5. **Independent research firms** ← most practical path for StockNow

**StockNow must register with BSEC before AI predictions can be shown to users.**

### Registration Requirements

| Requirement | Minimum Threshold |
|-------------|-------------------|
| Research team size | At least 3 members |
| Head of Research credentials | CFA, CPA, CA, CMA, or Master's in relevant field + **5 years** capital market experience |
| Analyst credentials | CFA, CPA, CA, CMA, MBA/MBM, or Master's in relevant field + **3 years** capital market experience |

### Timeline

**6–12 months** from application submission to approval. Application must begin before the product is built, not after.

Contact: BSEC official site — `sec.gov.bd/home/reglicensing`

---

## 2. BSEC-Compliant AI Recommendation Disclosure

Every AI-generated recommendation served to users must include the following elements. This entire disclosure must be stored immutably for 7 years.

### Required Disclosure Fields

| Field | Implementation |
|-------|----------------|
| Investment rationale | SHAP-based explanation in plain language |
| Methodology | Model type, training data range, key variables, validation approach |
| Identified risks | Model risk + company risk + market risk + currency risk |
| Investment recommendation | Buy / Hold / Sell + confidence level |
| Target price | 12-month target with valuation basis |
| Valuation methodology | DCF (absolute) + P/E multiples (relative) |
| Conflicts of interest | Whether StockNow holds positions; any fee relationships |
| Analyst credentials | Name + qualification of reviewing registered analyst |
| BSEC registration number | Required on every report |
| Timestamp | UTC timestamp of generation |
| Disclaimer | AI-generated, not personalized advice |

### Sample Disclosure Template

```
STOCKNOW AI RESEARCH REPORT
Registration: [BSEC-RA-XXXXXX] | Report ID: [UUID] | Date: [UTC Timestamp]

COMPANY: Grameenphone Ltd (GP) | EXCHANGE: DSE | SECTOR: Telecom

RECOMMENDATION: BUY | TARGET PRICE: BDT 380 | CURRENT PRICE: BDT 340
TIME HORIZON: 12 months | CONFIDENCE: 72%

--- INVESTMENT RATIONALE ---
AI-assisted analysis reviewed by [Analyst Name, CFA].

  Factor Analysis (SHAP-based):
  ├─ Volume surge (3-day avg vs 30-day avg):  +40% contribution  BULLISH
  ├─ P/E ratio vs sector median (14.2x/18.5x): +30% contribution BULLISH
  ├─ News sentiment index (0.72/1.0):          +20% contribution  BULLISH
  └─ Revenue growth last 2Q (-5% YoY):         -10% contribution  BEARISH
  Net: 80% positive weight → BUY

--- METHODOLOGY ---
Model: LightGBM ensemble | Training: DSE data 2015–2025
Features: 47 technical + 12 fundamental + 3 sentiment
Validation: Walk-forward backtesting | Backtest Sharpe: 1.34
Limitations: Does not account for unannounced regulatory changes
  or black swan events outside training distribution.

--- VALUATION ---
DCF @ 12% WACC → Fair value BDT 372
P/E target 16.5x × FY26E EPS BDT 23 = BDT 379.5

--- RISKS ---
Market: DSE illiquidity may prevent exit at target price
Model: AI predictions carry inherent uncertainty
Company: Regulatory headwinds in telecom sector

--- CONFLICTS OF INTEREST ---
StockNow holds no position in GP.
No investment banking relationship with GP in past 12 months.

--- DISCLAIMER ---
This is AI-assisted research reviewed by a registered research analyst.
It does not constitute personalized investment advice.
BSEC Registration: [No.] | Reviewing Analyst: [Name, Credentials]
```

### Generating the Disclosure from SHAP Output

```python
import shap, json
from datetime import datetime, timezone, timedelta

def generate_bsec_disclosure(
    model,
    input_features: dict,
    ticker: str,
    current_price: float,
    target_price: float,
    recommendation: str,
    analyst_name: str,
    analyst_credential: str,
    report_id: str,
) -> dict:
    import numpy as np, pandas as pd

    X = pd.DataFrame([input_features])
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X)[0]
    total_abs = np.sum(np.abs(shap_values))
    feature_names = list(input_features.keys())

    contributions = sorted([
        {
            "feature": feature_names[i],
            "shap_value": float(shap_values[i]),
            "contribution_pct": round(abs(float(shap_values[i])) / total_abs * 100, 1),
            "direction": "BULLISH" if shap_values[i] > 0 else "BEARISH",
            "raw_value": float(list(input_features.values())[i]),
        }
        for i in range(len(feature_names))
    ], key=lambda x: abs(x["shap_value"]), reverse=True)[:5]

    return {
        "report_id": report_id,
        "report_type": "ai_research_report",
        "bsec_registration": "BSEC-RA-XXXXXX",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "retain_until": (datetime.now(timezone.utc) + timedelta(days=2557)).isoformat(),
        "ticker": ticker,
        "exchange": "DSE",
        "recommendation": recommendation,
        "current_price_bdt": current_price,
        "target_price_bdt": target_price,
        "time_horizon_months": 12,
        "methodology": {
            "model_type": "LightGBM ensemble",
            "training_data": "DSE tick data 2015–2025",
            "feature_count": len(feature_names),
            "validation_method": "Walk-forward backtesting",
            "limitations": [
                "Does not account for unannounced regulatory changes",
                "Black swan events outside training distribution",
            ]
        },
        "factor_analysis": contributions,
        "human_review": {
            "analyst_name": analyst_name,
            "credentials": analyst_credential,
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
        },
        "conflicts_of_interest": {
            "stocknow_holds_position": False,
            "investment_banking_relationship_12m": False,
        },
        "risk_factors": [
            "DSE illiquidity risk",
            "AI model prediction uncertainty",
            "Sector-specific regulatory risk",
        ],
        "disclaimer": (
            "AI-assisted research reviewed by a BSEC-registered analyst. "
            "Not personalized investment advice. Past performance is not indicative of future results."
        ),
    }
```

---

## 3. Personal Data Protection Ordinance 2025 (PDPO)

### Effective Date and Enforcement

- **Enacted:** November 6, 2025 (Ordinance No. 61 of 2025)
- **Consent management, breach notification:** Active now
- **CDO/NDGA registration:** ~May 2027 (18-month runway from enactment)

### Data Classification Relevant to StockNow

| Tier | Category | StockNow Examples | Protection Level |
|------|----------|-------------------|-----------------|
| Confidential | NID, passport, TIN, mobile number, bank account, financial transaction data | All user KYC fields, payment data | Highest (criminal liability for breach) |
| Private | Portfolio positions, trade history, usage data | Internal analytics | Standard protection |
| Public | Stock prices, public filings | Market data | No restriction |

### Consent Requirements

Consent must be:
- **Voluntary** — no forced bundling with service access
- **Specific** — one purpose per consent record, not blanket
- **Explicit** — affirmative action required; no pre-ticked boxes
- **Informed** — user sees: purpose, retention duration, data recipients, right to withdraw
- **Revocable** — withdrawal must be as easy as giving consent

**Sensitive/confidential data** (NID, bank account) requires a **separate, explicit consent** — cannot be bundled with general terms acceptance.

### Consent Management Schema

```sql
-- Store every version of your consent texts
CREATE TABLE consent_versions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_number  TEXT NOT NULL UNIQUE,    -- "1.0", "1.1"
    purpose         TEXT NOT NULL,           -- "nid_processing", "ai_recommendations", "marketing"
    full_text       TEXT NOT NULL,
    summary_bn      TEXT,                    -- Bengali summary for accessibility
    effective_from  TIMESTAMPTZ NOT NULL,
    effective_to    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Append-only: never UPDATE or DELETE rows
CREATE TABLE user_consents (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id),
    consent_version_id  UUID NOT NULL REFERENCES consent_versions(id),
    purpose             TEXT NOT NULL,
    status              TEXT NOT NULL CHECK (status IN ('granted', 'withdrawn')),
    granted_at          TIMESTAMPTZ,
    withdrawn_at        TIMESTAMPTZ,
    ip_address          INET,
    user_agent          TEXT,
    channel             TEXT CHECK (channel IN ('web', 'mobile', 'api')),
    created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_user_consents_lookup ON user_consents(user_id, purpose, created_at DESC);

-- Current consent state per user per purpose
CREATE VIEW current_user_consents AS
SELECT DISTINCT ON (user_id, purpose)
    user_id, purpose, status, consent_version_id, granted_at, withdrawn_at
FROM user_consents
ORDER BY user_id, purpose, created_at DESC;
```

**Consent withdrawal flow:**
1. User clicks "Withdraw Consent" in Privacy Center
2. INSERT a new row with `status = 'withdrawn'` — never UPDATE
3. Downstream: immediately stop processing for that purpose
4. If purpose was `ai_recommendations`, stop serving AI recommendations
5. Display confirmation with server-side timestamp

**Privacy policy update flow:**
1. Create new `consent_versions` row with new `version_number`
2. Existing consents remain valid for their version
3. Prompt users to re-consent under the new version before using affected features

### Breach Notification Requirements

| Step | Timeline | Recipient | Content |
|------|----------|-----------|---------|
| NDGA notification | **72 hours** from discovery | National Data Governance Authority | Nature of breach, data categories, approximate subject count, consequences, remedial measures |
| User notification | Simultaneous or subsequent | Affected data subjects | If breach likely causes significant harm |

Maintain an incident response runbook. Implement SIEM alerting for anomalous data access patterns.

### Penalties

| Violation | Penalty |
|-----------|---------|
| Standard rights violation | BDT 3–5 lakh administrative fine |
| Security failure / confidential data breach | BDT 25 lakh fine |
| Significant fiduciary (large-scale processor) | 2–5% of Bangladesh annual turnover |
| Unauthorized processing of sensitive data | Up to 7 years imprisonment + BDT 20 lakh fine |

---

## 4. Audit Logging

### Architecture

```
Application
    ↓ emit_audit_event()
Kafka topic: audit-events
    acks=all, replication=3, retention=30 days
    ↓
Kafka Consumer (audit-writer service)
    ↓
PostgreSQL: audit.events (append-only, SHA-256 hash chain)
    ↓
Kafka Connect S3 Sink (nightly batch, 00:00 BDT)
    ↓
S3 WORM bucket: stocknow-audit-worm (Object Lock COMPLIANCE, 7 years)
```

### PostgreSQL Immutable Audit Schema

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS audit;

CREATE TABLE audit.events (
    id              BIGSERIAL PRIMARY KEY,
    event_id        UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    event_type      TEXT NOT NULL,
    actor_id        UUID,               -- NULL for system events
    actor_role      TEXT,               -- 'free_user', 'vip_user', 'admin', 'system'
    session_id      UUID,
    source_ip       INET,
    user_agent      TEXT,
    entity_type     TEXT,               -- 'portfolio', 'alert', 'recommendation', 'user'
    entity_id       TEXT,
    before_state    JSONB,
    after_state     JSONB,
    metadata        JSONB,              -- stock ticker, AI model version, etc.
    severity        TEXT CHECK (severity IN ('INFO', 'WARN', 'ERROR', 'CRITICAL')),
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    prev_hash       BYTEA,              -- SHA-256 of previous row
    row_hash        BYTEA NOT NULL      -- SHA-256 of this row content + prev_hash
);

-- Hash chain trigger: runs BEFORE INSERT on every row
CREATE OR REPLACE FUNCTION audit.compute_hash_chain()
RETURNS TRIGGER AS $$
DECLARE prev BYTEA;
BEGIN
    -- Advisory lock prevents concurrent inserts from forking the chain
    PERFORM pg_advisory_xact_lock(42);
    SELECT row_hash INTO prev FROM audit.events ORDER BY id DESC LIMIT 1;
    NEW.prev_hash := prev;
    NEW.row_hash  := digest(
        concat_ws('|',
            NEW.event_type, NEW.actor_id::text, NEW.entity_type,
            NEW.entity_id, NEW.occurred_at::text, NEW.after_state::text,
            encode(COALESCE(prev, ''::bytea), 'hex')
        ),
        'sha256'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_hash_chain
BEFORE INSERT ON audit.events
FOR EACH ROW EXECUTE FUNCTION audit.compute_hash_chain();

-- Permission hardening
CREATE ROLE stocknow_app;
GRANT USAGE ON SCHEMA audit TO stocknow_app;
GRANT INSERT, SELECT ON audit.events TO stocknow_app;
REVOKE UPDATE, DELETE ON audit.events FROM stocknow_app;

-- Auditor (read-only)
CREATE ROLE stocknow_auditor;
GRANT USAGE ON SCHEMA audit TO stocknow_auditor;
GRANT SELECT ON audit.events TO stocknow_auditor;
```

### Chain Verification Function

Run periodically by the compliance team to detect tampering:

```sql
CREATE OR REPLACE FUNCTION audit.verify_chain(from_id BIGINT DEFAULT 1)
RETURNS TABLE (id BIGINT, event_id UUID, status TEXT) AS $$
WITH ordered AS (
    SELECT e.id, e.event_id, e.prev_hash, e.row_hash,
        e.event_type, e.actor_id, e.entity_type, e.entity_id,
        e.occurred_at, e.after_state,
        LAG(e.row_hash) OVER (ORDER BY e.id) AS expected_prev,
        digest(
            concat_ws('|',
                e.event_type, e.actor_id::text, e.entity_type, e.entity_id,
                e.occurred_at::text, e.after_state::text,
                encode(LAG(e.row_hash) OVER (ORDER BY e.id), 'hex')
            ), 'sha256'
        ) AS recomputed_hash
    FROM audit.events e WHERE e.id >= from_id
)
SELECT id, event_id,
    CASE
        WHEN prev_hash IS DISTINCT FROM expected_prev  THEN 'BROKEN_CHAIN'
        WHEN row_hash  IS DISTINCT FROM recomputed_hash THEN 'HASH_MISMATCH'
        ELSE 'OK'
    END
FROM ordered
WHERE prev_hash IS DISTINCT FROM expected_prev
   OR row_hash  IS DISTINCT FROM recomputed_hash;
$$ LANGUAGE SQL STABLE;
```

### Kafka Event Producer

```python
from confluent_kafka import Producer
import json, uuid
from datetime import datetime, timezone

producer = Producer({
    'bootstrap.servers': 'kafka:9092',
    'acks': 'all',
    'enable.idempotence': True,
    'compression.type': 'snappy',
})

def emit_audit_event(
    event_type: str,
    actor_id: str | None,
    actor_role: str,
    entity_type: str,
    entity_id: str,
    before_state: dict | None = None,
    after_state: dict | None = None,
    metadata: dict | None = None,
    severity: str = 'INFO',
    source_ip: str | None = None,
):
    event = {
        'event_id': str(uuid.uuid4()),
        'event_type': event_type,
        'actor_id': actor_id,
        'actor_role': actor_role,
        'source_ip': source_ip,
        'entity_type': entity_type,
        'entity_id': entity_id,
        'before_state': before_state,
        'after_state': after_state,
        'metadata': metadata or {},
        'severity': severity,
        'occurred_at': datetime.now(timezone.utc).isoformat(),
    }
    producer.produce(
        'audit-events',
        key=entity_id.encode(),
        value=json.dumps(event).encode(),
    )
    producer.poll(0)
```

### Audit Event Taxonomy

```
# Authentication
auth.login.success          auth.login.failure          auth.logout
auth.token.refresh          auth.mfa.success            auth.mfa.failure
auth.password.change

# User account
user.register               user.profile.update         user.delete
user.consent.grant          user.consent.withdraw

# Data access
data.export.portfolio       data.export.history         data.export.report
data.access.bulk            data.download.csv

# AI activity
ai.recommendation.served    ai.recommendation.generated ai.model.retrained
ai.prediction.viewed        ai.alert.triggered

# Portfolio
portfolio.create            portfolio.update            portfolio.delete
portfolio.stock.add         portfolio.stock.remove

# Alerts
alert.create                alert.trigger               alert.resolve      alert.delete

# Admin actions
admin.user.suspend          admin.role.change           admin.data.access
admin.config.change         admin.audit.view

# Payments
payment.subscribe           payment.cancel              payment.refund
```

---

## 5. 7-Year Data Retention

### Tiered Storage

```
Day 0–90:     PostgreSQL (Hot)         Full query performance
Day 90–365:   S3 Standard-IA           Object Lock COMPLIANCE, 7-year retention
Day 365–730:  S3 Glacier Instant       <1 minute retrieval; ~40% cost reduction
Day 730–2555: S3 Glacier Deep Archive  12-hour retrieval SLA; ~80% cost reduction
```

### S3 WORM Bucket Setup

The bucket **must be created with Object Lock enabled at creation time** — this cannot be changed later.

```bash
# Step 1: Create bucket with Object Lock enabled
aws s3api create-bucket \
  --bucket stocknow-audit-worm \
  --region ap-south-1 \
  --create-bucket-configuration LocationConstraint=ap-south-1 \
  --object-lock-enabled-for-object-configuration '{"ObjectLockEnabled":"Enabled"}'

# Step 2: Enable versioning (required for Object Lock)
aws s3api put-bucket-versioning \
  --bucket stocknow-audit-worm \
  --versioning-configuration Status=Enabled

# Step 3: Set default 7-year COMPLIANCE retention
aws s3api put-object-lock-configuration \
  --bucket stocknow-audit-worm \
  --object-lock-configuration '{
    "ObjectLockEnabled": "Enabled",
    "Rule": {
      "DefaultRetention": { "Mode": "COMPLIANCE", "Years": 7 }
    }
  }'

# Step 4: Enable KMS encryption
aws s3api put-bucket-encryption \
  --bucket stocknow-audit-worm \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "aws:kms",
        "KMSMasterKeyID": "arn:aws:kms:ap-south-1:ACCOUNT_ID:key/KEY_ID"
      },
      "BucketKeyEnabled": true
    }]
  }'
```

Use `Mode: COMPLIANCE` — not GOVERNANCE. In Compliance mode, not even AWS admins can delete objects before the retention period expires.

### Lifecycle Policy (Automatic Glacier Transitions)

```bash
aws s3api put-bucket-lifecycle-configuration \
  --bucket stocknow-audit-worm \
  --lifecycle-configuration '{
    "Rules": [{
      "Id": "AuditLogsRetentionTiering",
      "Status": "Enabled",
      "Filter": {"Prefix": "audit/"},
      "Transitions": [
        {"Days": 90,  "StorageClass": "STANDARD_IA"},
        {"Days": 365, "StorageClass": "GLACIER_IR"},
        {"Days": 730, "StorageClass": "DEEP_ARCHIVE"}
      ]
    }]
  }'
```

### Python Upload with Explicit COMPLIANCE Lock

```python
import boto3
from datetime import datetime, timedelta, timezone

s3 = boto3.client('s3', region_name='ap-south-1')

def archive_to_worm(data: bytes, s3_key: str, retain_years: int = 7):
    retain_until = datetime.now(timezone.utc) + timedelta(days=365 * retain_years + 2)
    s3.put_object(
        Bucket='stocknow-audit-worm',
        Key=s3_key,
        Body=data,
        ObjectLockMode='COMPLIANCE',
        ObjectLockRetainUntilDate=retain_until,
        ServerSideEncryption='aws:kms',
    )
```

### Querying Archived Data (AWS Athena)

```sql
-- External table over archived Parquet files
CREATE EXTERNAL TABLE IF NOT EXISTS audit_archive (
    event_id    STRING,
    event_type  STRING,
    actor_id    STRING,
    actor_role  STRING,
    source_ip   STRING,
    entity_type STRING,
    entity_id   STRING,
    after_state STRING,
    severity    STRING,
    occurred_at TIMESTAMP
)
STORED AS PARQUET
LOCATION 's3://stocknow-audit-worm/audit/'
TBLPROPERTIES ('parquet.compress'='SNAPPY');

-- Example: all AI recommendations served to a user in a date range
SELECT event_id, occurred_at, entity_id, after_state
FROM audit_archive
WHERE event_type = 'ai.recommendation.served'
  AND actor_id = 'user-uuid-here'
  AND occurred_at BETWEEN TIMESTAMP '2025-01-01' AND TIMESTAMP '2025-12-31';
```

For Glacier Deep Archive: initiate restore first, wait up to 12 hours, then query via Athena.

---

## 6. PII Encryption

### What to Encrypt at the Application Layer

Encrypt these fields using AES-256-GCM before storing in the database. Even a full DB dump reveals only ciphertext.

- NID (National ID number)
- Mobile number
- Bank account number
- Passport number (if collected)

### Key Management

Use **AWS KMS with a Customer Managed Key (CMK)** in ap-south-1. Never hardcode keys.

Use envelope encryption:
1. KMS generates a Data Encryption Key (DEK) per user or per session
2. Use the DEK to encrypt PII
3. Store the KMS-encrypted DEK alongside the ciphertext
4. Decrypt by calling KMS to decrypt the DEK, then use DEK to decrypt PII

### AES-256-GCM Implementation

```python
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import os, base64

def encrypt_pii(plaintext: str, key: bytes) -> str:
    """
    key must be 32 bytes (256-bit), obtained from KMS data key.
    Returns base64-encoded nonce (12 bytes) + ciphertext + auth tag.
    """
    aesgcm = AESGCM(key)
    nonce  = os.urandom(12)  # 96-bit nonce — unique per encryption
    ct     = aesgcm.encrypt(nonce, plaintext.encode('utf-8'), None)
    return base64.b64encode(nonce + ct).decode('utf-8')

def decrypt_pii(token: str, key: bytes) -> str:
    data      = base64.b64decode(token.encode('utf-8'))
    nonce, ct = data[:12], data[12:]
    aesgcm    = AESGCM(key)
    return aesgcm.decrypt(nonce, ct, None).decode('utf-8')
```

### Database Schema for Encrypted PII

```sql
CREATE TABLE user_sensitive_data (
    user_id                  UUID PRIMARY KEY REFERENCES users(id),
    nid_encrypted            TEXT,       -- AES-256-GCM ciphertext
    mobile_encrypted         TEXT,
    bank_account_encrypted   TEXT,
    encrypted_at             TIMESTAMPTZ DEFAULT now(),
    kms_key_id               TEXT NOT NULL  -- which CMK version was used
);
-- Application role has SELECT + INSERT only — never UPDATE
-- To update PII: INSERT a new row (or use upsert), log the change to audit.events
```

---

## 7. Authentication and RBAC

### JWT Configuration

- **Access token:** 15 minutes, signed with RS256 or ES256
- **Refresh token:** 7 days, stored as SHA-256 hash in PostgreSQL
- **Refresh token rotation:** On each use, old token is invalidated and a new one issued
- **Refresh token family:** Reuse of an already-used refresh token invalidates **all tokens in the family** — protects against token theft

### JWT Payload

```json
{
  "sub": "user-uuid",
  "role": "vip_user",
  "tier": "premium",
  "permissions": ["read:prices", "read:ai_recommendations", "write:portfolio"],
  "iat": 1748000000,
  "exp": 1748000900,
  "jti": "unique-jwt-id"
}
```

### RBAC Matrix

| Permission | Anonymous | Free User | VIP User | Admin |
|------------|-----------|-----------|----------|-------|
| DSE prices (delayed 15-20s) | No | Yes | Yes | Yes |
| DSE prices (real-time) | No | No | Yes | Yes |
| AI predictions (delayed 24h) | No | Yes | No | Yes |
| AI predictions (real-time) | No | No | Yes | Yes |
| Portfolio management | No | Yes | Yes | Yes |
| Price alerts (max 5) | No | Yes | — | — |
| Price alerts (unlimited) | No | — | Yes | Yes |
| CSV export | No | No | Yes | Yes |
| Audit log access | No | No | No | Yes |
| User management | No | No | No | Yes |

### Rate Limiting (Redis Sliding Window)

```python
import redis, time

r = redis.Redis(host='redis', decode_responses=True)

RATE_LIMITS = {
    'anonymous':  {'requests': 10,   'window': 60},
    'free_user':  {'requests': 60,   'window': 60},
    'vip_user':   {'requests': 300,  'window': 60},
    'admin':      {'requests': 1000, 'window': 60},
}

ENDPOINT_LIMITS = {
    '/api/auth/login':    {'requests': 5,  'window': 300},   # 5 attempts per 5 min
    '/api/auth/forgot':   {'requests': 3,  'window': 3600},  # 3 per hour
    '/api/ml/recommend':  {'requests': 30, 'window': 60},    # prevent AI scraping
    '/api/data/export':   {'requests': 5,  'window': 3600},  # 5 exports per hour
}

def check_rate_limit(user_id: str, role: str, endpoint: str) -> tuple[bool, dict]:
    limits = ENDPOINT_LIMITS.get(endpoint) or RATE_LIMITS.get(role)
    key    = f"rl:{endpoint}:{user_id}"
    now    = int(time.time())

    pipe = r.pipeline()
    pipe.zremrangebyscore(key, 0, now - limits['window'])
    pipe.zadd(key, {str(now): now})
    pipe.zcard(key)
    pipe.expire(key, limits['window'])
    _, _, count, _ = pipe.execute()

    allowed = count <= limits['requests']
    return allowed, {
        'limit': limits['requests'],
        'remaining': max(0, limits['requests'] - count),
        'reset': now + limits['window'],
    }
```

---

## 8. TLS and Security Headers

### Nginx TLS Configuration

```nginx
ssl_protocols TLSv1.3;
ssl_prefer_server_ciphers off;
ssl_ciphers TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256;
ssl_session_timeout 1d;
ssl_session_cache shared:MozSSL:10m;

add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
add_header X-Content-Type-Options nosniff always;
add_header X-Frame-Options DENY always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; connect-src 'self' api.stocknow.com.bd" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

### OWASP API Security Controls

| Risk | Control |
|------|---------|
| API1: Broken Object Authorization | Row-level security — users access only their own portfolio and alerts |
| API2: Broken Authentication | 15-min JWTs, refresh token family rotation on reuse |
| API3: Broken Property Authorization | Explicit response schemas — never return raw DB rows |
| API4: Resource Consumption | Role-based rate limiting + pagination on all list endpoints |
| API5: Function Level Authorization | RBAC middleware enforced before any route handler |
| API6: Sensitive Business Flows | CAPTCHA on registration; fraud detection on bulk exports |
| API7: SSRF | Whitelist external URLs; no user-supplied URLs in server-side fetches |
| API8: Misconfiguration | TLS 1.3 only; HSTS; disable HTTP; remove debug endpoints in prod |
| API9: Inventory Management | API versioning (/api/v1/); decommission old versions |
| API10: Unsafe API Consumption | Validate and sanitize all DSE third-party data before processing |

---

## 9. Data Localization (PDPO 2025)

### The Requirement

PDPO 2025 requires at least one **synchronized real-time copy** of Confidential Personal Data (NID, mobile, bank account, financial transaction data) to remain **within Bangladesh**.

AWS has no Bangladesh region. The nearest region is ap-south-1 (Mumbai).

### Recommended Architecture

```
AWS ap-south-1 (Mumbai)                    Bangladesh
─────────────────────────────────          ─────────────────────────────
Next.js SSR servers                        Pico Public Cloud
Go API Gateway                             OR Felicity IDC
FastAPI (REST + ML)            ◄─sync─►   PII database (primary or mirror)
Kafka cluster                              Consent management DB (primary)
QuestDB / TimescaleDB                      BDIX edge node
Redis cluster                              (<5ms latency from Dhaka)
S3 WORM archival
Non-PII analytics
```

**Pico Public Cloud** (Fiber@Home affiliate, launched 2025, Mirantis-powered, ISO 27001, PCI-DSS, sovereign cloud) is the cleanest local option. Pricing in BDT.

**Felicity IDC** is the co-location alternative for self-managed servers.

### What Goes Where

| Data | Location |
|------|----------|
| NID, mobile number, bank account | Primary at Pico/Felicity (local); encrypted replica in Mumbai |
| Consent records | Primary at Pico/Felicity (local) |
| Stock prices, market data | AWS Mumbai (not PII) |
| ML model artifacts | AWS Mumbai (not PII) |
| Portfolio positions, trade history | AWS Mumbai with encrypted PII fields |
| Audit log (hot) | AWS Mumbai PostgreSQL |
| Audit log (cold, 7-year WORM) | AWS ap-south-1 S3 |

### Bangladesh Bank Cloud Guidelines

If StockNow integrates payment gateways or is licensed as an investment adviser with payment features, Bangladesh Bank Circular 05/2023 applies:
- Customer financial and sensitive data cannot be hosted cross-border in public cloud without prior Bangladesh Bank approval
- Private cloud must be physically within Bangladesh
- Apply for formal offshore cloud exception before adding payment functionality

---

## 10. Implementation Roadmap

### Immediate (Before Any User Data is Collected)

- [ ] Begin BSEC registration as Independent Research Firm or Investment Adviser
- [ ] Implement PDPO consent management schema (append-only `user_consents` table)
- [ ] Build consent UI: separate consent per purpose, withdrawal flow, Bengali summary
- [ ] Deploy PostgreSQL audit log with hash chain trigger
- [ ] Implement JWT auth with 15-min access tokens + refresh token family rotation
- [ ] Apply AES-256-GCM encryption to all PII fields using AWS KMS CMK
- [ ] Configure TLS 1.3 only + security headers on all endpoints
- [ ] Set up role-based rate limiting (Redis sliding window)

### Within 90 Days of Launch

- [ ] Create S3 WORM bucket in ap-south-1 with Object Lock COMPLIANCE (7-year)
- [ ] Set up Kafka Connect S3 Sink for nightly audit archival (Parquet + Snappy)
- [ ] Integrate BSEC disclosure generator into AI recommendation pipeline
- [ ] Deploy PII database mirror at Pico Public Cloud or Felicity IDC
- [ ] Configure real-time sync from Mumbai PostgreSQL to local PII store
- [ ] Create AWS Athena external table over archived audit Parquet files
- [ ] Write and test 72-hour breach notification runbook

### Within 18 Months of PDPO Enactment (by May 2027)

- [ ] Appoint CDO (Chief Data Officer) — NDGA registration requirement
- [ ] Submit first compliance report to NDGA
- [ ] Complete first annual audit log chain verification
- [ ] Confirm 7-year retention is intact and Athena queries return correct records
- [ ] Conduct penetration test (Bangladesh Bank ICT guideline requirement)
- [ ] Review and update RBAC matrix for any new features added
