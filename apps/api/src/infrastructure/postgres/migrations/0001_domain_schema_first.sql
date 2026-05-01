CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email TEXT NOT NULL,
  email_normalized TEXT GENERATED ALWAYS AS (lower(btrim(email))) STORED,
  display_name TEXT NOT NULL,
  external_subject TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT users_email_normalized_unique UNIQUE (email_normalized),
  CONSTRAINT users_external_subject_unique UNIQUE (external_subject)
);

CREATE TABLE subscriptions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  effective_window TSTZRANGE GENERATED ALWAYS AS (tstzrange(period_start, period_end, '[)')) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_status_allowed CHECK (status IN ('activa', 'limitada', 'sin_acceso', 'cancelada')),
  CONSTRAINT subscriptions_valid_period CHECK (period_end > period_start),
  CONSTRAINT subscriptions_no_overlap EXCLUDE USING gist (user_id WITH =, effective_window WITH &&)
);

CREATE TABLE usage_ledger (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  subscription_id BIGINT REFERENCES subscriptions(id) ON DELETE SET NULL,
  operation_type TEXT NOT NULL,
  units INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT usage_ledger_operation_type_allowed CHECK (
    operation_type IN ('analisis_documento', 'generacion_documento')
  ),
  CONSTRAINT usage_ledger_units_fixed CHECK (units = 1)
);

CREATE INDEX subscriptions_user_id_idx ON subscriptions (user_id);
CREATE INDEX usage_ledger_user_id_idx ON usage_ledger (user_id);
CREATE INDEX usage_ledger_subscription_id_idx ON usage_ledger (subscription_id);
CREATE INDEX usage_ledger_user_created_at_idx ON usage_ledger (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION set_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_column();

CREATE TRIGGER subscriptions_set_updated_at
BEFORE UPDATE ON subscriptions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_column();

CREATE OR REPLACE FUNCTION usage_ledger_reject_mutations()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'usage_ledger is append-only';
END;
$$;

CREATE TRIGGER usage_ledger_append_only
BEFORE UPDATE OR DELETE ON usage_ledger
FOR EACH ROW
EXECUTE FUNCTION usage_ledger_reject_mutations();

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY;

ALTER TABLE usage_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_ledger FORCE ROW LEVEL SECURITY;

CREATE POLICY users_owner_isolation ON users
  USING (
    current_setting('app.current_user_id', true) IS NOT NULL
    AND id = current_setting('app.current_user_id', true)::BIGINT
  )
  WITH CHECK (
    current_setting('app.current_user_id', true) IS NOT NULL
    AND id = current_setting('app.current_user_id', true)::BIGINT
  );

CREATE POLICY subscriptions_owner_isolation ON subscriptions
  USING (
    current_setting('app.current_user_id', true) IS NOT NULL
    AND user_id = current_setting('app.current_user_id', true)::BIGINT
  )
  WITH CHECK (
    current_setting('app.current_user_id', true) IS NOT NULL
    AND user_id = current_setting('app.current_user_id', true)::BIGINT
  );

CREATE POLICY usage_ledger_owner_isolation ON usage_ledger
  USING (
    current_setting('app.current_user_id', true) IS NOT NULL
    AND user_id = current_setting('app.current_user_id', true)::BIGINT
  )
  WITH CHECK (
    current_setting('app.current_user_id', true) IS NOT NULL
    AND user_id = current_setting('app.current_user_id', true)::BIGINT
  );
