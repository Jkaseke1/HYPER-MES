-- =====================================================
-- Chick Module: Payment Alerts (Email + WhatsApp)
-- =====================================================

-- 1. Create payment alerts log table
CREATE TABLE IF NOT EXISTS chick_payment_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES chick_supplier_invoices(id) ON DELETE CASCADE,
  po_id UUID REFERENCES chick_purchase_orders(id),
  alert_type TEXT NOT NULL CHECK (alert_type IN ('PAYMENT_DUE', 'REMINDER', 'OVERDUE')),
  channel TEXT NOT NULL CHECK (channel IN ('EMAIL', 'WHATSAPP', 'BOTH')),
  recipient_email TEXT,
  recipient_phone TEXT,
  recipient_name TEXT,
  recipient_role TEXT,
  message_subject TEXT,
  message_body TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  triggered_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE chick_payment_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read chick_payment_alerts"
  ON chick_payment_alerts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert chick_payment_alerts"
  ON chick_payment_alerts FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update chick_payment_alerts"
  ON chick_payment_alerts FOR UPDATE TO authenticated USING (true);

-- 2. Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_chick_payment_alerts_invoice
  ON chick_payment_alerts(invoice_id);

CREATE INDEX IF NOT EXISTS idx_chick_payment_alerts_status
  ON chick_payment_alerts(status, created_at DESC);

-- 3. Add notification preferences to profiles (optional, for per-user settings)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS notify_email BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notify_whatsapp BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;

-- 4. Create trigger function to auto-fire alert when invoice is VERIFIED
CREATE OR REPLACE FUNCTION public.handle_invoice_verified_alert()
RETURNS TRIGGER AS $$
DECLARE
  v_po_id UUID;
  v_supplier_name TEXT;
  v_po_number TEXT;
  v_invoice_amount NUMERIC;
  v_recipient RECORD;
  v_alert_id UUID;
BEGIN
  -- Only fire when status changes TO 'VERIFIED'
  IF NEW.status = 'VERIFIED' AND (OLD.status IS NULL OR OLD.status != 'VERIFIED') THEN
    -- Get related PO info
    SELECT 
      sc.po_id,
      s.name AS supplier_name,
      po.po_number,
      NEW.invoice_amount
    INTO v_po_id, v_supplier_name, v_po_number, v_invoice_amount
    FROM chick_supplier_consignments sc
    JOIN chick_suppliers s ON s.id = sc.supplier_id
    LEFT JOIN chick_purchase_orders po ON po.id = sc.po_id
    WHERE sc.id = NEW.consignment_id;

    -- Find finance + admin users to notify
    FOR v_recipient IN
      SELECT 
        p.id AS profile_id,
        p.email,
        p.whatsapp_number,
        p.full_name,
        p.role
      FROM profiles p
      WHERE p.role IN ('finance', 'admin', 'accountant')
        AND p.notify_email = true
    LOOP
      -- Insert alert record (edge function will pick these up and send)
      INSERT INTO chick_payment_alerts (
        invoice_id,
        po_id,
        alert_type,
        channel,
        recipient_email,
        recipient_phone,
        recipient_name,
        recipient_role,
        message_subject,
        message_body,
        status
      ) VALUES (
        NEW.id,
        v_po_id,
        'PAYMENT_DUE',
        CASE 
          WHEN v_recipient.whatsapp_number IS NOT NULL THEN 'BOTH'
          ELSE 'EMAIL'
        END,
        v_recipient.email,
        v_recipient.whatsapp_number,
        v_recipient.full_name,
        v_recipient.role,
        'Payment Due: Invoice ' || NEW.invoice_number || ' from ' || v_supplier_name,
        'Invoice ' || NEW.invoice_number || ' from ' || COALESCE(v_supplier_name, 'Supplier') || 
        ' for PO ' || COALESCE(v_po_number, 'N/A') || 
        ' has been verified. Amount: $' || COALESCE(v_invoice_amount::text, '0') || 
        '. Please arrange payment.',
        'PENDING'
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Attach trigger to chick_supplier_invoices
DROP TRIGGER IF EXISTS trg_invoice_verified_alert ON chick_supplier_invoices;

CREATE TRIGGER trg_invoice_verified_alert
  AFTER UPDATE ON chick_supplier_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_invoice_verified_alert();

-- 6. Also trigger on INSERT if status is already VERIFIED
DROP TRIGGER IF EXISTS trg_invoice_insert_verified_alert ON chick_supplier_invoices;

CREATE TRIGGER trg_invoice_insert_verified_alert
  AFTER INSERT ON chick_supplier_invoices
  FOR EACH ROW
  WHEN (NEW.status = 'VERIFIED')
  EXECUTE FUNCTION public.handle_invoice_verified_alert();
