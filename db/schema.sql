-- Finance dashboard v2.17.0 — Cloudflare D1 (SQLite) schema.
-- Apply remotely via:  npx wrangler d1 execute finance-monthly --file=db/schema.sql --remote

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS monthly_snapshots (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id              INTEGER NOT NULL DEFAULT 1,
  period                 TEXT    NOT NULL,
  captured_at            TEXT    NOT NULL,
  source                 TEXT    NOT NULL DEFAULT 'cron'
                                  CHECK (source IN ('cron','manual','backfill')),
  revenue_paid           REAL,
  revenue_invoiced       REAL,
  active_clients         INTEGER,
  new_clients            INTEGER,
  cash_position          REAL,
  gross_margin_pct       REAL,
  dso_days               INTEGER,
  collection_rate_pct    REAL,
  payment_velocity_days  INTEGER,
  ar_total               REAL,
  ar_overdue             REAL,
  ar_aging_current       REAL,
  ar_aging_30_60         REAL,
  ar_aging_60_90         REAL,
  ar_aging_90plus        REAL,
  overdue_count          INTEGER,
  ap_total               REAL,
  net_cash_flow          REAL,
  loc_recommended        REAL,
  loc_dscr               REAL,
  borrowing_base         REAL,
  bank_score_community   INTEGER,
  bank_score_sba         INTEGER,
  bank_score_fintech     INTEGER,
  goal_revenue_target    REAL,
  goal_clients_target    INTEGER,
  goal_collection_pct    REAL,
  payload_json           TEXT,
  UNIQUE (tenant_id, period)
);
CREATE INDEX IF NOT EXISTS ix_snapshot_captured ON monthly_snapshots(captured_at);

CREATE TABLE IF NOT EXISTS swot_entries (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id   INTEGER NOT NULL DEFAULT 1,
  period      TEXT    NOT NULL,
  category    TEXT    NOT NULL CHECK (category IN ('S','W','O','T')),
  tag         TEXT    NOT NULL DEFAULT 'Strategic',
  body        TEXT    NOT NULL,
  author      TEXT    NOT NULL,
  created_at  TEXT    NOT NULL,
  updated_at  TEXT    NOT NULL,
  archived_at TEXT
);
CREATE INDEX IF NOT EXISTS ix_swot_period_tag ON swot_entries(tenant_id, period, tag);
CREATE INDEX IF NOT EXISTS ix_swot_active     ON swot_entries(tenant_id, archived_at);

CREATE TABLE IF NOT EXISTS role_views (
  role         TEXT    NOT NULL,
  tenant_id    INTEGER NOT NULL DEFAULT 1,
  config_json  TEXT    NOT NULL,
  updated_at   TEXT    NOT NULL,
  PRIMARY KEY (tenant_id, role)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id    INTEGER NOT NULL DEFAULT 1,
  actor        TEXT    NOT NULL,
  action       TEXT    NOT NULL,
  target       TEXT,
  payload_json TEXT,
  at           TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_audit_at     ON audit_log(at);
CREATE INDEX IF NOT EXISTS ix_audit_action ON audit_log(action);
