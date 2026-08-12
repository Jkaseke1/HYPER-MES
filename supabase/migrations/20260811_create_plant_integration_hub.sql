-- Plant integration hub
-- Keeps MES as the governed operational record while allowing Automill,
-- PLC/SCADA, weighbridge, laboratory, and future plant systems to connect
-- through a consistent, auditable contract.

CREATE TABLE IF NOT EXISTS plant_integration_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key text NOT NULL UNIQUE CHECK (source_key ~ '^[a-z0-9][a-z0-9_-]*$'),
  name text NOT NULL,
  provider text NOT NULL DEFAULT 'custom',
  integration_type text NOT NULL DEFAULT 'api' CHECK (integration_type IN ('api', 'webhook', 'database', 'file_drop', 'opc_ua', 'mqtt', 'manual')),
  endpoint_url text,
  authentication_method text NOT NULL DEFAULT 'gateway_secret' CHECK (authentication_method IN ('gateway_secret', 'mutual_tls', 'api_key', 'none')),
  polling_interval_seconds integer CHECK (polling_interval_seconds IS NULL OR polling_interval_seconds >= 5),
  enabled boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'not_configured' CHECK (status IN ('not_configured', 'testing', 'connected', 'paused', 'error')),
  last_seen_at timestamptz,
  last_error text,
  capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plant_integration_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES plant_integration_sources(id) ON DELETE CASCADE,
  event_key text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'production_started', 'production_completed', 'production_count',
    'machine_state', 'downtime_started', 'downtime_ended', 'quality_result',
    'weighbridge_ticket', 'inventory_movement', 'maintenance_alert', 'custom'
  )),
  occurred_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  production_order_id uuid REFERENCES production_orders(id) ON DELETE SET NULL,
  machine_id uuid REFERENCES machines(id) ON DELETE SET NULL,
  batch_number text,
  processing_status text NOT NULL DEFAULT 'received' CHECK (processing_status IN ('received', 'validated', 'processed', 'rejected', 'error')),
  processing_error text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz,
  UNIQUE(source_id, event_key)
);

CREATE INDEX IF NOT EXISTS idx_plant_integration_events_source_received
  ON plant_integration_events(source_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_plant_integration_events_status
  ON plant_integration_events(processing_status, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_plant_integration_events_order
  ON plant_integration_events(production_order_id, occurred_at DESC);

ALTER TABLE plant_integration_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE plant_integration_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read plant integration sources"
  ON plant_integration_sources FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage plant integration sources"
  ON plant_integration_sources FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can read plant integration events"
  ON plant_integration_events FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

CREATE OR REPLACE FUNCTION update_plant_integration_source_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_plant_integration_source_updated_at ON plant_integration_sources;
CREATE TRIGGER set_plant_integration_source_updated_at
  BEFORE UPDATE ON plant_integration_sources
  FOR EACH ROW EXECUTE FUNCTION update_plant_integration_source_timestamp();

COMMENT ON TABLE plant_integration_sources IS
  'Configuration only for plant-system adapters. Credentials must remain in a secure on-site gateway or server-side secret store.';
COMMENT ON TABLE plant_integration_events IS
  'Immutable inbound event ledger. A gateway validates and writes idempotent source/event keys before MES business processing.';
