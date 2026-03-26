-- Sales Orders Management
-- Replaces manual WhatsApp order tracking

-- Sales Orders table
CREATE TABLE IF NOT EXISTS sales_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  customer_location TEXT NOT NULL,
  customer_contact TEXT,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date DATE NOT NULL,
  total_tonnage DECIMAL(10,3) NOT NULL DEFAULT 0,
  total_value DECIMAL(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'in_production', 'ready', 'dispatched', 'delivered', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent')),
  notes TEXT,
  branch_id UUID REFERENCES branches(id),
  created_by UUID REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sales Order Items table
CREATE TABLE IF NOT EXISTS sales_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  formulation_id UUID REFERENCES formulations(id),
  product_code TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity DECIMAL(10,3) NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kg',
  unit_price DECIMAL(10,2) NOT NULL,
  line_total DECIMAL(12,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily Production Reports table
CREATE TABLE IF NOT EXISTS daily_production_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE NOT NULL,
  branch_id UUID NOT NULL REFERENCES branches(id),
  shift TEXT NOT NULL CHECK (shift IN ('day', 'night')),
  batch_number TEXT,
  plant_name TEXT NOT NULL,
  formulation_id UUID REFERENCES formulations(id),
  product_name TEXT NOT NULL,
  daily_target DECIMAL(10,3),
  quantity_produced DECIMAL(10,3) NOT NULL DEFAULT 0,
  quantity_sold DECIMAL(10,3) DEFAULT 0,
  vet_sales DECIMAL(10,3) DEFAULT 0,
  equipment_sales DECIMAL(10,3) DEFAULT 0,
  labour_force INTEGER,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'no_production')),
  downtime_hours DECIMAL(5,2) DEFAULT 0,
  downtime_reason TEXT,
  notes TEXT,
  reported_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(report_date, branch_id, shift, plant_name)
);

-- Production Issues/Downtime Log table
CREATE TABLE IF NOT EXISTS production_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  branch_id UUID NOT NULL REFERENCES branches(id),
  shift TEXT NOT NULL CHECK (shift IN ('day', 'night')),
  issue_type TEXT NOT NULL CHECK (issue_type IN ('power_outage', 'equipment_failure', 'material_shortage', 'maintenance', 'other')),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  affected_plant TEXT,
  downtime_hours DECIMAL(5,2),
  resolution TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES profiles(id),
  reported_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customer POL (Point of Lay) Bookings table
CREATE TABLE IF NOT EXISTS pol_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_date DATE NOT NULL DEFAULT CURRENT_DATE,
  customer_name TEXT NOT NULL,
  customer_location TEXT NOT NULL,
  customer_contact TEXT,
  quantity_booked INTEGER NOT NULL,
  total_booked INTEGER NOT NULL,
  expected_delivery_date DATE,
  status TEXT NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'confirmed', 'delivered', 'cancelled')),
  notes TEXT,
  branch_id UUID REFERENCES branches(id),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_expected_date ON sales_orders(expected_delivery_date);
CREATE INDEX IF NOT EXISTS idx_sales_orders_branch ON sales_orders(branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_order_items_order ON sales_order_items(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_daily_reports_date ON daily_production_reports(report_date);
CREATE INDEX IF NOT EXISTS idx_daily_reports_branch ON daily_production_reports(branch_id);
CREATE INDEX IF NOT EXISTS idx_production_issues_date ON production_issues(issue_date);
CREATE INDEX IF NOT EXISTS idx_production_issues_branch ON production_issues(branch_id);
CREATE INDEX IF NOT EXISTS idx_pol_bookings_date ON pol_bookings(booking_date);

-- Triggers for updated_at
CREATE TRIGGER update_sales_orders_updated_at BEFORE UPDATE ON sales_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sales_order_items_updated_at BEFORE UPDATE ON sales_order_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_production_reports_updated_at BEFORE UPDATE ON daily_production_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_production_issues_updated_at BEFORE UPDATE ON production_issues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pol_bookings_updated_at BEFORE UPDATE ON pol_bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_production_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE pol_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sales orders" ON sales_orders FOR SELECT USING (true);
CREATE POLICY "Users can insert sales orders" ON sales_orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update sales orders" ON sales_orders FOR UPDATE USING (true);

CREATE POLICY "Users can view sales order items" ON sales_order_items FOR SELECT USING (true);
CREATE POLICY "Users can insert sales order items" ON sales_order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update sales order items" ON sales_order_items FOR UPDATE USING (true);

CREATE POLICY "Users can view daily reports" ON daily_production_reports FOR SELECT USING (true);
CREATE POLICY "Users can insert daily reports" ON daily_production_reports FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update daily reports" ON daily_production_reports FOR UPDATE USING (true);

CREATE POLICY "Users can view production issues" ON production_issues FOR SELECT USING (true);
CREATE POLICY "Users can insert production issues" ON production_issues FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update production issues" ON production_issues FOR UPDATE USING (true);

CREATE POLICY "Users can view POL bookings" ON pol_bookings FOR SELECT USING (true);
CREATE POLICY "Users can insert POL bookings" ON pol_bookings FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update POL bookings" ON pol_bookings FOR UPDATE USING (true);

-- Add sales orders to pending approvals view
DROP VIEW IF EXISTS pending_approvals;
CREATE VIEW pending_approvals AS
SELECT 
  'sales_order' as entity_type,
  id as entity_id,
  order_number as entity_number,
  customer_name as entity_name,
  status,
  created_at,
  created_by,
  branch_id
FROM sales_orders
WHERE status = 'pending'

UNION ALL

SELECT 
  'grn' as entity_type,
  id as entity_id,
  grn_number as entity_number,
  supplier_name as entity_name,
  status,
  created_at,
  received_by as created_by,
  branch_id
FROM goods_received_notes
WHERE status = 'pending'

UNION ALL

SELECT 
  'quality_inspection' as entity_type,
  id as entity_id,
  batch_number as entity_number,
  batch_number as entity_name,
  result as status,
  created_at,
  NULL as created_by,
  NULL as branch_id
FROM quality_inspections
WHERE result = 'pending'

UNION ALL

SELECT 
  'production_order' as entity_type,
  id as entity_id,
  batch_number as entity_number,
  batch_number as entity_name,
  status,
  created_at,
  operator_id as created_by,
  NULL as branch_id
FROM production_orders
WHERE status = 'pending'

UNION ALL

SELECT 
  'dispatch_order' as entity_type,
  id as entity_id,
  dispatch_number as entity_number,
  dispatch_number as entity_name,
  status,
  created_at,
  prepared_by as created_by,
  branch_id
FROM dispatch_orders
WHERE status = 'pending';
