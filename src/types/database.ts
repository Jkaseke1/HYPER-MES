export interface Profile {
  id: string;
  full_name: string;
  role: 'production_manager' | 'supervisor' | 'warehouse_manager' | 'operator' | 'finance' | 'admin' | 'raw_material_manager' | 'accountant';
  email: string;
  phone: string;
  created_at: string;
  updated_at: string;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  address: string;
  contact_person: string;
  phone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  type: 'raw_material' | 'finished_goods';
  branch_id: string | null;
  location: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  branches?: Branch;
}

export interface Machine {
  id: string;
  name: string;
  code: string;
  type: string;
  capacity_per_hour: number;
  capacity_unit: string;
  status: 'operational' | 'maintenance' | 'breakdown' | 'decommissioned';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  code: string;
  sage_code: string | null;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  payment_terms: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RawMaterial {
  id: string;
  name: string;
  code: string;
  category: string;
  unit: string;
  cost_per_unit: number;
  currency_code: string;
  cost_per_unit_usd: number;
  reorder_level: number;
  current_stock: number;
  alert_threshold_pct: number;
  days_of_cover_target: number;
  alert_channels: string[];
  warehouse_id: string | null;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  warehouses?: Warehouse;
}

export interface InventoryForecastRow {
  raw_material_id: string;
  name: string;
  code: string;
  current_stock: number;
  avg_daily_usage: number;
  days_to_depletion: number | null;
}

export interface MonthlyTrendRow {
  month: string;
  consumption_t: number;
  production_t: number;
  dispatch_t: number;
}

export interface GoodsReceivedNote {
  id: string;
  grn_number: string;
  supplier_id: string | null;
  warehouse_id: string | null;
  received_date: string;
  weigh_bridge_ticket_no?: string | null;
  weigh_bridge_ticket_date?: string | null;
  weigh_bridge_ticket_weight?: number | null;
  weigh_bridge_ticket_unit?: string | null;
  weigh_bridge_ticket_driver_name?: string | null;
  weigh_bridge_ticket_vehicle_number?: string | null;
  weigh_bridge_ticket_gross_weight?: number | null;
  weigh_bridge_ticket_tare_weight?: number | null;
  weigh_bridge_ticket_net_weight?: number | null;
  status: 'pending' | 'rm_approved' | 'approved' | 'rejected' | 'inspecting';
  notes: string;
  received_by: string | null;
  total_value: number;
  approval_step?: string | null;
  rm_approved_by?: string | null;
  rm_approved_at?: string | null;
  accountant_approved_by?: string | null;
  accountant_approved_at?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  rejection_reason?: string | null;
  wb_transaction_no?: string | null;
  wb_vehicle_reg?: string | null;
  wb_haulier_code?: string | null;
  wb_product_code?: string | null;
  wb_comment?: string | null;
  wb_trailer_number?: string | null;
  wb_driver_name?: string | null;
  wb_driver_id?: string | null;
  wb_time_in?: string | null;
  wb_first_mass?: number | null;
  wb_time_out?: string | null;
  wb_second_mass?: number | null;
  wb_nett_mass?: number | null;
  wb_driver_signed?: boolean;
  created_at: string;
  updated_at: string;
  suppliers?: Supplier;
  warehouses?: Warehouse;
}

export interface GRNItem {
  id: string;
  grn_id: string;
  raw_material_id: string;
  ordered_qty: number;
  received_qty: number;
  unit_cost: number;
  batch_number: string;
  expiry_date: string | null;
  line_total: number;
  created_at: string;
  raw_materials?: RawMaterial;
}

export interface Formulation {
  id: string;
  name: string;
  code: string;
  sage_code: string;
  version: number;
  category: string;
  description: string;
  batch_size: number;
  batch_unit: string;
  unit_size_variants: Array<{ size: string; batch_size: number }> | null;
  target_protein: number;
  target_fat: number;
  target_fiber: number;
  target_moisture: number;
  estimated_cost_per_unit: number;
  status: 'draft' | 'active' | 'archived';
  created_by: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
  current_stock: number;
}

export interface FormulationIngredient {
  id: string;
  formulation_id: string;
  raw_material_id: string;
  quantity: number;
  unit: string;
  percentage: number;
  is_critical: boolean;
  notes: string;
  sort_order: number;
  created_at: string;
  raw_materials?: RawMaterial;
}

export interface ProductionPlan {
  id: string;
  plan_number: string;
  plan_date: string;
  start_date: string;
  end_date: string;
  status: 'draft' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  notes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductionPlanItem {
  id: string;
  plan_id: string;
  formulation_id: string;
  planned_qty: number;
  unit: string;
  priority: number;
  notes: string;
  created_at: string;
  formulations?: Formulation;
}

export interface ProductionOrder {
  id: string;
  batch_number: string;
  plan_id: string | null;
  formulation_id: string | null;
  machine_id: string | null;
  planned_qty: number;
  actual_qty: number;
  rejected_qty: number;
  wastage_qty: number;
  unit: string;
  status: 'pending' | 'materials_issued' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  planned_start: string | null;
  planned_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  operator_id: string | null;
  supervisor_id: string | null;
  raw_material_cost: number;
  labour_cost: number;
  machine_cost: number;
  overhead_cost: number;
  total_cost: number;
  cost_per_unit: number;
  notes: string;
  approved_by?: string | null;
  approved_at?: string | null;
  rejection_reason?: string | null;
  created_at: string;
  updated_at: string;
  formulations?: Formulation;
  machines?: Machine;
  profiles?: Profile;
}

export interface ProductionOrderMaterial {
  id: string;
  production_order_id: string;
  raw_material_id: string;
  planned_qty: number;
  actual_qty: number;
  wastage_qty: number;
  unit: string;
  unit_cost: number;
  total_cost: number;
  issued: boolean;
  issued_at: string | null;
  issued_by: string | null;
  created_at: string;
  raw_materials?: RawMaterial;
}

export interface ProductionLog {
  id: string;
  production_order_id: string;
  machine_id: string | null;
  operator_id: string | null;
  log_type: 'start' | 'stop' | 'pause' | 'resume' | 'downtime' | 'issue' | 'info';
  description: string;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number;
  created_at: string;
}

export interface StockMovement {
  id: string;
  movement_type: string;
  reference_type: string;
  reference_id: string | null;
  raw_material_id: string | null;
  formulation_id: string | null;
  warehouse_id: string | null;
  quantity: number;
  unit: string;
  batch_number: string;
  movement_date: string;
  performed_by: string | null;
  notes: string;
  created_at: string;
  raw_materials?: RawMaterial;
  formulations?: Formulation;
  warehouses?: Warehouse;
}

export interface DispatchOrder {
  id: string;
  dispatch_number: string;
  branch_id: string | null;
  warehouse_id: string | null;
  dispatch_date: string;
  status: 'pending' | 'loading' | 'dispatched' | 'in_transit' | 'delivered' | 'cancelled';
  vehicle_number: string;
  driver_name: string;
  total_weight: number;
  total_value: number;
  prepared_by: string | null;
  approved_by: string | null;
  approved_at?: string | null;
  rejection_reason?: string | null;
  delivery_notes: string;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
  branches?: Branch;
  warehouses?: Warehouse;
}

export interface DispatchItem {
  id: string;
  dispatch_order_id: string;
  formulation_id: string | null;
  batch_number: string;
  quantity: number;
  unit: string;
  unit_price: number;
  line_total: number;
  created_at: string;
  formulations?: Formulation;
}
