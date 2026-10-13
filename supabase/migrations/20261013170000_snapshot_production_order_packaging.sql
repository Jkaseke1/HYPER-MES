-- Snapshot the packaging choice on each production order.
-- Formula BOM packaging remains the default, but Production can explicitly
-- select the correct active SKU before the order is created.

CREATE TABLE IF NOT EXISTS public.production_order_packaging (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id uuid NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
  packaging_sku_id uuid NOT NULL REFERENCES public.packaging_skus(id),
  item_code text NOT NULL,
  description text NOT NULL,
  unit text NOT NULL DEFAULT 'bags',
  planned_qty numeric NOT NULL DEFAULT 0 CHECK (planned_qty >= 0),
  actual_qty numeric NOT NULL DEFAULT 0 CHECK (actual_qty >= 0),
  unit_cost numeric NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (production_order_id, packaging_sku_id)
);

CREATE INDEX IF NOT EXISTS idx_production_order_packaging_order
  ON public.production_order_packaging (production_order_id);

ALTER TABLE public.production_order_packaging ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read production order packaging"
  ON public.production_order_packaging;
CREATE POLICY "Authenticated users can read production order packaging"
  ON public.production_order_packaging FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert production order packaging"
  ON public.production_order_packaging;
CREATE POLICY "Authenticated users can insert production order packaging"
  ON public.production_order_packaging FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update production order packaging"
  ON public.production_order_packaging;
CREATE POLICY "Authenticated users can update production order packaging"
  ON public.production_order_packaging FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);
