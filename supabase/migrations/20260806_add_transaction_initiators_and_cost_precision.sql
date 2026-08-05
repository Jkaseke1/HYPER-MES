-- Migration: Add transaction initiator references and cost precision support
-- Description: Ensures created_by column exists on production_orders and adds indexes for fast initiator lookups across transaction tables.

DO $$ 
BEGIN
  -- Add created_by to production_orders if it doesn't already exist
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'production_orders' 
    AND column_name = 'created_by'
  ) THEN
    ALTER TABLE production_orders ADD COLUMN created_by UUID REFERENCES profiles(id);
  END IF;

  -- Add created_by to material_transfers if requested_by is aliased or if missing
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'material_transfers' 
    AND column_name = 'created_by'
  ) THEN
    ALTER TABLE material_transfers ADD COLUMN created_by UUID REFERENCES profiles(id);
  END IF;
END $$;

-- Create indexes for performance on initiator foreign keys
CREATE INDEX IF NOT EXISTS idx_wb_tickets_created_by ON weigh_bridge_tickets(created_by);
CREATE INDEX IF NOT EXISTS idx_grn_received_by ON goods_received_notes(received_by);
CREATE INDEX IF NOT EXISTS idx_material_transfers_requested_by ON material_transfers(requested_by);
CREATE INDEX IF NOT EXISTS idx_production_orders_created_by ON production_orders(created_by);
CREATE INDEX IF NOT EXISTS idx_production_orders_operator_id ON production_orders(operator_id);
