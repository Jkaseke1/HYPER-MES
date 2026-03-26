-- Plant Maintenance Module
-- Tables for preventive and corrective maintenance management

-- Spare parts inventory
CREATE TABLE IF NOT EXISTS spare_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  category text NOT NULL CHECK (category IN ('mechanical', 'electrical', 'consumable', 'lubricant', 'safety', 'other')),
  unit text NOT NULL DEFAULT 'pcs',
  unit_cost numeric DEFAULT 0,
  currency_code text DEFAULT 'USD',
  reorder_level numeric DEFAULT 0,
  current_stock numeric DEFAULT 0,
  warehouse_id uuid REFERENCES warehouses(id),
  supplier_id uuid REFERENCES suppliers(id),
  lead_time_days integer DEFAULT 7,
  is_critical boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Maintenance schedules (preventive maintenance plans)
CREATE TABLE IF NOT EXISTS maintenance_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_code text UNIQUE NOT NULL,
  machine_id uuid NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  maintenance_type text NOT NULL CHECK (maintenance_type IN ('preventive', 'inspection', 'calibration', 'lubrication', 'cleaning')),
  frequency_type text NOT NULL CHECK (frequency_type IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'hours_based', 'cycles_based')),
  frequency_value integer NOT NULL DEFAULT 1,
  estimated_duration_minutes integer DEFAULT 60,
  last_performed_date date,
  next_due_date date,
  assigned_to uuid REFERENCES profiles(id),
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Maintenance work orders (both preventive and corrective)
CREATE TABLE IF NOT EXISTS maintenance_work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wo_number text UNIQUE NOT NULL,
  schedule_id uuid REFERENCES maintenance_schedules(id),
  machine_id uuid NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id),
  work_type text NOT NULL CHECK (work_type IN ('preventive', 'corrective', 'breakdown', 'inspection', 'calibration', 'modification')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'assigned', 'in_progress', 'on_hold', 'completed', 'cancelled')),
  title text NOT NULL,
  description text,
  reported_by uuid REFERENCES profiles(id),
  assigned_to uuid REFERENCES profiles(id),
  scheduled_date date,
  started_at timestamptz,
  completed_at timestamptz,
  estimated_duration_minutes integer,
  actual_duration_minutes integer,
  downtime_minutes integer DEFAULT 0,
  production_impact_qty numeric DEFAULT 0,
  root_cause text,
  corrective_action text,
  labor_cost numeric DEFAULT 0,
  parts_cost numeric DEFAULT 0,
  total_cost numeric DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Maintenance task checklist items
CREATE TABLE IF NOT EXISTS maintenance_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES maintenance_work_orders(id) ON DELETE CASCADE,
  task_number integer NOT NULL,
  description text NOT NULL,
  is_completed boolean DEFAULT false,
  completed_by uuid REFERENCES profiles(id),
  completed_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(work_order_id, task_number)
);

-- Spare parts usage tracking
CREATE TABLE IF NOT EXISTS spare_parts_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES maintenance_work_orders(id) ON DELETE CASCADE,
  spare_part_id uuid NOT NULL REFERENCES spare_parts(id),
  quantity_used numeric NOT NULL,
  unit_cost numeric DEFAULT 0,
  line_total numeric DEFAULT 0,
  batch_number text,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Equipment downtime log (detailed tracking)
CREATE TABLE IF NOT EXISTS equipment_downtime_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id uuid NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  work_order_id uuid REFERENCES maintenance_work_orders(id),
  downtime_type text NOT NULL CHECK (downtime_type IN ('planned', 'unplanned', 'breakdown', 'changeover', 'waiting_parts', 'waiting_technician')),
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  duration_minutes integer,
  production_order_id uuid REFERENCES production_orders(id),
  planned_output_qty numeric DEFAULT 0,
  actual_output_qty numeric DEFAULT 0,
  output_loss_qty numeric DEFAULT 0,
  description text,
  reported_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_spare_parts_warehouse ON spare_parts(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_spare_parts_supplier ON spare_parts(supplier_id);
CREATE INDEX IF NOT EXISTS idx_spare_parts_category ON spare_parts(category);
CREATE INDEX IF NOT EXISTS idx_spare_parts_active ON spare_parts(is_active);

CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_machine ON maintenance_schedules(machine_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_assigned ON maintenance_schedules(assigned_to);
CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_next_due ON maintenance_schedules(next_due_date);
CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_active ON maintenance_schedules(is_active);

CREATE INDEX IF NOT EXISTS idx_work_orders_schedule ON maintenance_work_orders(schedule_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_machine ON maintenance_work_orders(machine_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_branch ON maintenance_work_orders(branch_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON maintenance_work_orders(status);
CREATE INDEX IF NOT EXISTS idx_work_orders_assigned ON maintenance_work_orders(assigned_to);
CREATE INDEX IF NOT EXISTS idx_work_orders_scheduled_date ON maintenance_work_orders(scheduled_date);

CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_wo ON maintenance_tasks(work_order_id);
CREATE INDEX IF NOT EXISTS idx_spare_parts_usage_wo ON spare_parts_usage(work_order_id);
CREATE INDEX IF NOT EXISTS idx_spare_parts_usage_part ON spare_parts_usage(spare_part_id);

CREATE INDEX IF NOT EXISTS idx_downtime_log_machine ON equipment_downtime_log(machine_id);
CREATE INDEX IF NOT EXISTS idx_downtime_log_wo ON equipment_downtime_log(work_order_id);
CREATE INDEX IF NOT EXISTS idx_downtime_log_started ON equipment_downtime_log(started_at);
CREATE INDEX IF NOT EXISTS idx_downtime_log_type ON equipment_downtime_log(downtime_type);

-- RLS Policies
ALTER TABLE spare_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE spare_parts_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_downtime_log ENABLE ROW LEVEL SECURITY;

-- Spare parts policies
CREATE POLICY "Users can view spare parts" ON spare_parts FOR SELECT USING (true);
CREATE POLICY "Authorized users can insert spare parts" ON spare_parts FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authorized users can update spare parts" ON spare_parts FOR UPDATE USING ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authorized users can delete spare parts" ON spare_parts FOR DELETE USING ((select auth.uid()) IS NOT NULL);

-- Maintenance schedules policies
CREATE POLICY "Users can view maintenance schedules" ON maintenance_schedules FOR SELECT USING (true);
CREATE POLICY "Authorized users can insert schedules" ON maintenance_schedules FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authorized users can update schedules" ON maintenance_schedules FOR UPDATE USING ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authorized users can delete schedules" ON maintenance_schedules FOR DELETE USING ((select auth.uid()) IS NOT NULL);

-- Work orders policies
CREATE POLICY "Users can view work orders" ON maintenance_work_orders FOR SELECT USING (true);
CREATE POLICY "Authorized users can insert work orders" ON maintenance_work_orders FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authorized users can update work orders" ON maintenance_work_orders FOR UPDATE USING ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authorized users can delete work orders" ON maintenance_work_orders FOR DELETE USING ((select auth.uid()) IS NOT NULL);

-- Maintenance tasks policies
CREATE POLICY "Users can view tasks" ON maintenance_tasks FOR SELECT USING (true);
CREATE POLICY "Authorized users can insert tasks" ON maintenance_tasks FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authorized users can update tasks" ON maintenance_tasks FOR UPDATE USING ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authorized users can delete tasks" ON maintenance_tasks FOR DELETE USING ((select auth.uid()) IS NOT NULL);

-- Spare parts usage policies
CREATE POLICY "Users can view parts usage" ON spare_parts_usage FOR SELECT USING (true);
CREATE POLICY "Authorized users can insert parts usage" ON spare_parts_usage FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authorized users can update parts usage" ON spare_parts_usage FOR UPDATE USING ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authorized users can delete parts usage" ON spare_parts_usage FOR DELETE USING ((select auth.uid()) IS NOT NULL);

-- Downtime log policies
CREATE POLICY "Users can view downtime log" ON equipment_downtime_log FOR SELECT USING (true);
CREATE POLICY "Authorized users can insert downtime" ON equipment_downtime_log FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authorized users can update downtime" ON equipment_downtime_log FOR UPDATE USING ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Authorized users can delete downtime" ON equipment_downtime_log FOR DELETE USING ((select auth.uid()) IS NOT NULL);

-- Function to auto-update timestamps
CREATE OR REPLACE FUNCTION update_maintenance_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_spare_parts_updated_at BEFORE UPDATE ON spare_parts FOR EACH ROW EXECUTE FUNCTION update_maintenance_updated_at();
CREATE TRIGGER update_maintenance_schedules_updated_at BEFORE UPDATE ON maintenance_schedules FOR EACH ROW EXECUTE FUNCTION update_maintenance_updated_at();
CREATE TRIGGER update_work_orders_updated_at BEFORE UPDATE ON maintenance_work_orders FOR EACH ROW EXECUTE FUNCTION update_maintenance_updated_at();
CREATE TRIGGER update_downtime_log_updated_at BEFORE UPDATE ON equipment_downtime_log FOR EACH ROW EXECUTE FUNCTION update_maintenance_updated_at();
