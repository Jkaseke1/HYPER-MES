/*
  # Add Missing Foreign Key Indexes

  This migration adds indexes on all foreign key columns that were missing covering indexes.
  Missing indexes on foreign keys cause suboptimal query performance, especially during JOINs
  and cascading operations.

  1. Tables and Indexes Added
    - `dispatch_items`: dispatch_order_id, formulation_id
    - `dispatch_orders`: approved_by, prepared_by, warehouse_id
    - `formulation_ingredients`: formulation_id, raw_material_id
    - `formulations`: approved_by, created_by
    - `goods_received_notes`: received_by, supplier_id, warehouse_id
    - `grn_items`: grn_id, raw_material_id
    - `production_logs`: machine_id, operator_id, production_order_id
    - `production_order_materials`: issued_by, production_order_id, raw_material_id
    - `production_orders`: formulation_id, machine_id, operator_id, plan_id, supervisor_id
    - `production_outputs`: production_order_id, recorded_by, warehouse_id
    - `production_plan_items`: formulation_id, plan_id
    - `production_plans`: created_by
    - `quality_inspections`: grn_id, inspector_id, raw_material_id
    - `raw_materials`: warehouse_id
    - `stock_movements`: formulation_id, performed_by
    - `warehouses`: branch_id

  2. Important Notes
    - All indexes use IF NOT EXISTS to prevent errors if any already exist
    - These indexes improve JOIN performance and foreign key constraint checks
*/

-- dispatch_items
CREATE INDEX IF NOT EXISTS idx_dispatch_items_dispatch_order_id ON public.dispatch_items (dispatch_order_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_items_formulation_id ON public.dispatch_items (formulation_id);

-- dispatch_orders
CREATE INDEX IF NOT EXISTS idx_dispatch_orders_approved_by ON public.dispatch_orders (approved_by);
CREATE INDEX IF NOT EXISTS idx_dispatch_orders_prepared_by ON public.dispatch_orders (prepared_by);
CREATE INDEX IF NOT EXISTS idx_dispatch_orders_warehouse_id ON public.dispatch_orders (warehouse_id);

-- formulation_ingredients
CREATE INDEX IF NOT EXISTS idx_formulation_ingredients_formulation_id ON public.formulation_ingredients (formulation_id);
CREATE INDEX IF NOT EXISTS idx_formulation_ingredients_raw_material_id ON public.formulation_ingredients (raw_material_id);

-- formulations
CREATE INDEX IF NOT EXISTS idx_formulations_approved_by ON public.formulations (approved_by);
CREATE INDEX IF NOT EXISTS idx_formulations_created_by ON public.formulations (created_by);

-- goods_received_notes
CREATE INDEX IF NOT EXISTS idx_goods_received_notes_received_by ON public.goods_received_notes (received_by);
CREATE INDEX IF NOT EXISTS idx_goods_received_notes_supplier_id ON public.goods_received_notes (supplier_id);
CREATE INDEX IF NOT EXISTS idx_goods_received_notes_warehouse_id ON public.goods_received_notes (warehouse_id);

-- grn_items
CREATE INDEX IF NOT EXISTS idx_grn_items_grn_id ON public.grn_items (grn_id);
CREATE INDEX IF NOT EXISTS idx_grn_items_raw_material_id ON public.grn_items (raw_material_id);

-- production_logs
CREATE INDEX IF NOT EXISTS idx_production_logs_machine_id ON public.production_logs (machine_id);
CREATE INDEX IF NOT EXISTS idx_production_logs_operator_id ON public.production_logs (operator_id);
CREATE INDEX IF NOT EXISTS idx_production_logs_production_order_id ON public.production_logs (production_order_id);

-- production_order_materials
CREATE INDEX IF NOT EXISTS idx_production_order_materials_issued_by ON public.production_order_materials (issued_by);
CREATE INDEX IF NOT EXISTS idx_production_order_materials_production_order_id ON public.production_order_materials (production_order_id);
CREATE INDEX IF NOT EXISTS idx_production_order_materials_raw_material_id ON public.production_order_materials (raw_material_id);

-- production_orders
CREATE INDEX IF NOT EXISTS idx_production_orders_formulation_id ON public.production_orders (formulation_id);
CREATE INDEX IF NOT EXISTS idx_production_orders_machine_id ON public.production_orders (machine_id);
CREATE INDEX IF NOT EXISTS idx_production_orders_operator_id ON public.production_orders (operator_id);
CREATE INDEX IF NOT EXISTS idx_production_orders_plan_id ON public.production_orders (plan_id);
CREATE INDEX IF NOT EXISTS idx_production_orders_supervisor_id ON public.production_orders (supervisor_id);

-- production_outputs
CREATE INDEX IF NOT EXISTS idx_production_outputs_production_order_id ON public.production_outputs (production_order_id);
CREATE INDEX IF NOT EXISTS idx_production_outputs_recorded_by ON public.production_outputs (recorded_by);
CREATE INDEX IF NOT EXISTS idx_production_outputs_warehouse_id ON public.production_outputs (warehouse_id);

-- production_plan_items
CREATE INDEX IF NOT EXISTS idx_production_plan_items_formulation_id ON public.production_plan_items (formulation_id);
CREATE INDEX IF NOT EXISTS idx_production_plan_items_plan_id ON public.production_plan_items (plan_id);

-- production_plans
CREATE INDEX IF NOT EXISTS idx_production_plans_created_by ON public.production_plans (created_by);

-- quality_inspections
CREATE INDEX IF NOT EXISTS idx_quality_inspections_grn_id ON public.quality_inspections (grn_id);
CREATE INDEX IF NOT EXISTS idx_quality_inspections_inspector_id ON public.quality_inspections (inspector_id);
CREATE INDEX IF NOT EXISTS idx_quality_inspections_raw_material_id ON public.quality_inspections (raw_material_id);

-- raw_materials
CREATE INDEX IF NOT EXISTS idx_raw_materials_warehouse_id ON public.raw_materials (warehouse_id);

-- stock_movements
CREATE INDEX IF NOT EXISTS idx_stock_movements_formulation_id ON public.stock_movements (formulation_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_performed_by ON public.stock_movements (performed_by);

-- warehouses
CREATE INDEX IF NOT EXISTS idx_warehouses_branch_id ON public.warehouses (branch_id);