-- Candidate only: not deployed. Opt-in orders plus service-owned verified snapshots.
-- No existing lot functions, GRN/transfer functions or balances are replaced.
BEGIN;
CREATE TABLE public.pd_warehouse_issue_orders (
  order_id uuid PRIMARY KEY REFERENCES public.production_orders(id),
  enabled boolean NOT NULL DEFAULT false,
  company_database text NOT NULL CHECK (length(company_database)>0),
  warehouse_id integer NOT NULL CHECK (warehouse_id>0),
  enabled_reason text NOT NULL CHECK (length(enabled_reason)>0)
);
CREATE TABLE public.pd_warehouse_item_policy (
  sage_code text PRIMARY KEY,
  warehouse_mode_allowed boolean NOT NULL DEFAULT false,
  unit text NOT NULL CHECK (unit IN ('kg','bags')),
  lot_controlled boolean NOT NULL,
  review_note text NOT NULL CHECK (length(review_note)>0)
);
-- available_quantity must be SDK free stock less manufacturing WIP, not on-hand.
-- Source must verify company, warehouse, unit, lot configuration and WIP coverage.
CREATE TABLE public.pd_verified_stock (
  sage_code text NOT NULL,
  warehouse_id integer NOT NULL,
  company_database text NOT NULL,
  available_quantity numeric NOT NULL CHECK (available_quantity >= 0 AND available_quantity::text NOT IN ('NaN','Infinity','-Infinity')),
  unit text NOT NULL,
  lot_controlled boolean NOT NULL,
  wip_verified boolean NOT NULL,
  observed_at timestamptz NOT NULL,
  source_evidence text NOT NULL CHECK (length(source_evidence)>0),
  PRIMARY KEY (company_database, warehouse_id, sage_code)
);
CREATE TABLE public.pd_warehouse_reservations (
  order_id uuid NOT NULL REFERENCES public.production_orders(id),
  sage_code text NOT NULL,
  warehouse_id integer NOT NULL,
  company_database text NOT NULL,
  quantity numeric NOT NULL CHECK (quantity>0 AND quantity::text NOT IN ('NaN','Infinity','-Infinity')),
  unit text NOT NULL,
  observed_at timestamptz NOT NULL,
  source_evidence text NOT NULL,
  actor_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (order_id,sage_code)
);
-- No browser can enable an order, classify an item, attest stock or release a hold.
ALTER TABLE public.pd_warehouse_issue_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pd_warehouse_item_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pd_verified_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pd_warehouse_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pd_warehouse_issue_orders, public.pd_warehouse_item_policy,
  public.pd_verified_stock, public.pd_warehouse_reservations FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.pd_warehouse_issue_orders, public.pd_warehouse_item_policy,
  public.pd_verified_stock, public.pd_warehouse_reservations TO service_role;

-- Preserve observation order when overlapping refreshes finish out of order.
CREATE FUNCTION public.publish_verified_pd_stock(p_sage_code text,p_available_quantity numeric,p_observed_at timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE policy public.pd_warehouse_item_policy%ROWTYPE;
BEGIN
  SELECT * INTO policy FROM pd_warehouse_item_policy WHERE sage_code=p_sage_code AND warehouse_mode_allowed FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No reviewed warehouse-stock policy for %',p_sage_code; END IF;
  IF p_observed_at IS NULL OR p_observed_at>clock_timestamp() OR p_observed_at<clock_timestamp()-interval '2 minutes'
    THEN RAISE EXCEPTION 'PD stock observation is outside the allowed window'; END IF;
  INSERT INTO pd_verified_stock VALUES(p_sage_code,19,'Hyperfeeds UAT Bench 20261124',p_available_quantity,
    policy.unit,policy.lot_controlled,true,p_observed_at,'Native UAT SDK PD availability. Item review: '||policy.review_note)
  ON CONFLICT(company_database,warehouse_id,sage_code) DO UPDATE SET
    available_quantity=excluded.available_quantity,unit=excluded.unit,lot_controlled=excluded.lot_controlled,
    wip_verified=excluded.wip_verified,observed_at=excluded.observed_at,source_evidence=excluded.source_evidence
    WHERE pd_verified_stock.observed_at<excluded.observed_at;
END $$;
REVOKE ALL ON FUNCTION public.publish_verified_pd_stock(text,numeric,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.publish_verified_pd_stock(text,numeric,timestamptz) TO service_role;

CREATE FUNCTION public.pd_warehouse_requirements(p_order uuid)
RETURNS TABLE(sage_code text,quantity numeric,unit text) LANGUAGE sql STABLE
SET search_path=public,pg_temp AS $$
  SELECT upper(btrim(coalesce(nullif(r.sage_code,''),r.code))),m.planned_qty,coalesce(m.unit,'kg')
  FROM production_order_materials m JOIN raw_materials r ON r.id=m.raw_material_id
  WHERE m.production_order_id=p_order
  UNION ALL
  SELECT upper(btrim(p.item_code)),p.planned_qty,p.unit
  FROM production_order_packaging p WHERE p.production_order_id=p_order;
$$;
REVOKE ALL ON FUNCTION public.pd_warehouse_requirements(uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.preview_pd_warehouse_issue(p_order uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE cfg public.pd_warehouse_issue_orders%ROWTYPE; r record; stock public.pd_verified_stock%ROWTYPE;
  held numeric; reason text; lines jsonb:='[]'; ready boolean:=true;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO cfg FROM pd_warehouse_issue_orders WHERE order_id=p_order;
  IF NOT FOUND OR NOT cfg.enabled THEN RETURN jsonb_build_object('enabled',false,'ready',false,'lines',lines); END IF;
  IF NOT EXISTS(SELECT 1 FROM production_order_materials WHERE production_order_id=p_order)
    OR EXISTS(SELECT 1 FROM pd_warehouse_requirements(p_order) WHERE quantity IS NULL OR quantity<=0
      OR quantity::text IN ('NaN','Infinity','-Infinity') OR sage_code IS NULL OR sage_code='') THEN
    RAISE EXCEPTION 'Invalid or missing material requirements';
  END IF;
  IF EXISTS(SELECT 1 FROM pd_warehouse_requirements(p_order) GROUP BY sage_code HAVING count(DISTINCT unit)<>1) THEN
    RAISE EXCEPTION 'Conflicting units for a Sage item';
  END IF;
  FOR r IN SELECT q.sage_code,sum(q.quantity) quantity,min(q.unit) unit
    FROM pd_warehouse_requirements(p_order) q GROUP BY q.sage_code ORDER BY q.sage_code
  LOOP
    reason:=NULL; held:=0;
    SELECT * INTO stock FROM pd_verified_stock s WHERE s.sage_code=r.sage_code
      AND s.warehouse_id=cfg.warehouse_id AND s.company_database=cfg.company_database;
    IF NOT FOUND THEN reason:='Verified PD availability is missing';
    ELSIF stock.observed_at<clock_timestamp()-interval '2 minutes' OR stock.observed_at>clock_timestamp() THEN
      reason:='Refresh verified PD availability';
    ELSIF NOT stock.wip_verified THEN reason:='Manufacturing WIP availability is unverified';
    ELSIF stock.lot_controlled THEN reason:='Lot-controlled item: use the lot allocation workflow';
    ELSIF stock.unit IS DISTINCT FROM r.unit THEN reason:='Sage and MES units differ';
    END IF;
    IF EXISTS(SELECT 1 FROM pd_warehouse_item_policy p WHERE p.sage_code=r.sage_code
      AND p.warehouse_mode_allowed AND p.lot_controlled) THEN
      reason:='Lot-controlled item: use the lot allocation workflow';
    ELSIF NOT EXISTS(SELECT 1 FROM pd_warehouse_item_policy p WHERE p.sage_code=r.sage_code
      AND p.warehouse_mode_allowed AND p.unit=r.unit AND NOT p.lot_controlled) THEN
      reason:='Warehouse-stock policy has not been approved for this item';
    END IF;
    IF EXISTS(SELECT 1 FROM quality_lot_controls q JOIN raw_materials m ON m.id=q.raw_material_id
      WHERE upper(btrim(coalesce(nullif(m.sage_code,''),m.code)))=r.sage_code AND q.disposition<>'released') THEN
      reason:='Unresolved quality restriction: reconcile before warehouse-stock issue';
    END IF;
    -- A reservation remains held on failed/unknown outcomes. It is covered by
    -- Sage only after a successful issue ACK predating this stock observation.
    SELECT coalesce(sum(h.quantity),0) INTO held FROM pd_warehouse_reservations h
      WHERE h.sage_code=r.sage_code AND h.company_database=cfg.company_database AND h.warehouse_id=cfg.warehouse_id
      AND NOT EXISTS(SELECT 1 FROM sync_log e WHERE e.reference_id=h.order_id
        AND e.reference_type='production_orders' AND e.event_type='materials_issued'
        AND e.status='success' AND e.updated_at<stock.observed_at);
    IF reason IS NULL AND stock.available_quantity-held<r.quantity THEN reason:='Insufficient unreserved PD stock'; END IF;
    ready:=ready AND reason IS NULL;
    lines:=lines||jsonb_build_array(jsonb_build_object('sageCode',r.sage_code,'required',r.quantity,'unit',r.unit,
      'available',CASE WHEN stock.available_quantity IS NOT NULL THEN greatest(0,stock.available_quantity-held) END,'reason',reason));
  END LOOP;
  RETURN jsonb_build_object('enabled',true,'ready',ready,'lines',lines);
END $$;
REVOKE ALL ON FUNCTION public.preview_pd_warehouse_issue(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.preview_pd_warehouse_issue(uuid) TO authenticated;

CREATE FUNCTION public.request_pd_warehouse_stock_refresh(p_order uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE codes text[]; order_status text;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND role IN ('finance','accountant','admin')) THEN
    RAISE EXCEPTION 'Finance access is required';
  END IF;
  SELECT status INTO order_status FROM production_orders WHERE id=p_order FOR UPDATE;
  IF order_status IS DISTINCT FROM 'pending_finance' OR NOT EXISTS(
    SELECT 1 FROM pd_warehouse_issue_orders WHERE order_id=p_order AND enabled
      AND company_database='Hyperfeeds UAT Bench 20261124' AND warehouse_id=19) THEN
    RAISE EXCEPTION 'PD stock refresh is unavailable for this order';
  END IF;
  SELECT array_agg(DISTINCT sage_code ORDER BY sage_code) INTO codes FROM pd_warehouse_requirements(p_order)
    WHERE sage_code IS NOT NULL AND sage_code<>'';
  IF coalesce(cardinality(codes),0) NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'Invalid number of Sage items'; END IF;
  IF EXISTS(SELECT 1 FROM sync_log WHERE reference_id=p_order AND event_type='sage_stock_refresh'
    AND reference_type='production_orders' AND status IN ('pending','processing')
    AND details->>'pdWarehouseRefresh'='true') THEN RETURN; END IF;
  INSERT INTO sync_log(event_type,reference_type,reference_id,status,details)
  VALUES('sage_stock_refresh','production_orders',p_order,'pending',
    jsonb_build_object('itemCodes',codes,'warehouseCodes',ARRAY['PD'],'pdWarehouseRefresh',true));
END $$;
REVOKE ALL ON FUNCTION public.request_pd_warehouse_stock_refresh(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.request_pd_warehouse_stock_refresh(uuid) TO authenticated;

CREATE FUNCTION public.approve_pd_warehouse_issue(p_order uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE cfg public.pd_warehouse_issue_orders%ROWTYPE; review jsonb; changed integer; n integer; state text;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND role IN ('finance','accountant','admin')) THEN
    RAISE EXCEPTION 'Finance approval required'; END IF;
  SELECT status INTO state FROM production_orders WHERE id=p_order FOR UPDATE;
  IF state IS DISTINCT FROM 'pending_finance' THEN RAISE EXCEPTION 'Order is not awaiting Finance; reload and reconcile'; END IF;
  SELECT * INTO cfg FROM pd_warehouse_issue_orders WHERE order_id=p_order AND enabled FOR UPDATE;
  IF NOT FOUND OR cfg.company_database<>'Hyperfeeds UAT Bench 20261124' OR cfg.warehouse_id<>19 THEN
    RAISE EXCEPTION 'Warehouse-stock mode is not enabled for this UAT order'; END IF;
  IF EXISTS(SELECT 1 FROM sync_log WHERE reference_id=p_order AND event_type='materials_issued')
    OR EXISTS(SELECT 1 FROM production_order_materials WHERE production_order_id=p_order AND issued)
    OR EXISTS(SELECT 1 FROM pd_warehouse_reservations WHERE order_id=p_order) THEN
    RAISE EXCEPTION 'An issue or reservation already exists; reconcile instead of reissuing'; END IF;
  IF NOT EXISTS(SELECT 1 FROM production_orders o JOIN formulations f ON f.id=o.formulation_id
    WHERE o.id=p_order AND f.status='active') THEN RAISE EXCEPTION 'An active approved formula is required'; END IF;
  IF EXISTS(SELECT 1 FROM production_order_materials WHERE production_order_id=p_order AND unit IS DISTINCT FROM 'kg')
    OR NOT EXISTS(SELECT 1 FROM production_orders o WHERE o.id=p_order AND o.planned_qty>0
      AND abs(o.planned_qty-(SELECT sum(planned_qty) FROM production_order_materials WHERE production_order_id=p_order))<=0.001) THEN
    RAISE EXCEPTION 'Ingredient units or BOM mass balance are invalid'; END IF;
  -- Freeze BOM and packaging while taking snapshots and reserving stock.
  PERFORM 1 FROM production_order_materials WHERE production_order_id=p_order ORDER BY id FOR UPDATE;
  PERFORM 1 FROM production_order_packaging WHERE production_order_id=p_order ORDER BY id FOR UPDATE;
  PERFORM 1 FROM pd_warehouse_item_policy p WHERE p.sage_code IN (SELECT sage_code FROM pd_warehouse_requirements(p_order))
    ORDER BY p.sage_code FOR SHARE;
  PERFORM 1 FROM pd_verified_stock s WHERE s.company_database=cfg.company_database AND s.warehouse_id=cfg.warehouse_id
    AND s.sage_code IN (SELECT sage_code FROM pd_warehouse_requirements(p_order)) ORDER BY s.sage_code FOR UPDATE;
  LOCK TABLE quality_lot_controls IN SHARE MODE;
  review:=preview_pd_warehouse_issue(p_order);
  IF review->>'ready' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'PD availability check failed: %',review; END IF;
  INSERT INTO pd_warehouse_reservations(order_id,sage_code,warehouse_id,company_database,quantity,unit,observed_at,source_evidence,actor_id)
    SELECT p_order,q.sage_code,cfg.warehouse_id,cfg.company_database,q.quantity,q.unit,s.observed_at,s.source_evidence,auth.uid()
    FROM (SELECT sage_code,sum(quantity) quantity,min(unit) unit FROM pd_warehouse_requirements(p_order) GROUP BY sage_code) q
    JOIN pd_verified_stock s ON s.sage_code=q.sage_code AND s.company_database=cfg.company_database AND s.warehouse_id=cfg.warehouse_id;
  -- These are MES issue authorizations; physical consumption/WIP is posted only
  -- by Sage. No raw_materials.current_stock or raw_material_lots mutation.
  UPDATE production_order_materials m SET actual_qty=m.planned_qty,issued=true,issued_by=auth.uid(),issued_at=now(),
    unit_cost=round(coalesce(r.cost_per_unit,0)::numeric,4),
    total_cost=round((m.planned_qty*coalesce(r.cost_per_unit,0))::numeric,4)
    FROM raw_materials r WHERE m.production_order_id=p_order AND r.id=m.raw_material_id;
  GET DIAGNOSTICS changed=ROW_COUNT;
  PERFORM record_production_daily_issues_once(p_order);
  UPDATE production_orders SET status='materials_issued',approved_by=auth.uid(),approved_at=now() WHERE id=p_order;
  SELECT count(*) INTO n FROM sync_log WHERE reference_id=p_order AND event_type='materials_issued';
  IF n<>1 OR NOT EXISTS(SELECT 1 FROM sync_log WHERE reference_id=p_order AND event_type='materials_issued'
    AND reference_type='production_orders' AND status='pending') THEN RAISE EXCEPTION 'Expected exactly one pending Sage issue event'; END IF;
  UPDATE sync_log SET details=coalesce(details,'{}'::jsonb)||jsonb_build_object('pdWarehouseIssue',true)
    WHERE reference_id=p_order AND event_type='materials_issued';
  PERFORM log_approval_action('production_order',p_order,'approved','pending_finance','materials_issued',auth.uid(),
    'Finance authorized warehouse-stock issue from verified PD availability; Sage posting remains pending.');
  RETURN changed;
END $$;
REVOKE ALL ON FUNCTION public.approve_pd_warehouse_issue(uuid) FROM PUBLIC,anon;
-- Issue approval stays disabled in the stock-only bench preparation.
-- Protect order requirements once reserved, including direct browser edits.
CREATE FUNCTION public.guard_pd_warehouse_requirements() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE oid uuid;
BEGIN
  oid:=CASE WHEN TG_OP='DELETE' THEN OLD.production_order_id ELSE NEW.production_order_id END;
  IF TG_OP='UPDATE' AND OLD.production_order_id IS DISTINCT FROM NEW.production_order_id
    AND EXISTS(SELECT 1 FROM pd_warehouse_reservations WHERE order_id=OLD.production_order_id) THEN
    RAISE EXCEPTION 'Reserved requirements cannot move to another order'; END IF;
  IF EXISTS(SELECT 1 FROM pd_warehouse_reservations WHERE order_id=oid) THEN
    IF TG_OP IN ('INSERT','DELETE') THEN RAISE EXCEPTION 'Reserved requirements are immutable'; END IF;
    IF TG_TABLE_NAME='production_order_materials' THEN
      IF NEW.raw_material_id IS DISTINCT FROM OLD.raw_material_id OR NEW.unit IS DISTINCT FROM OLD.unit
        OR NEW.planned_qty IS DISTINCT FROM OLD.planned_qty
        OR (OLD.issued AND (NEW.issued IS DISTINCT FROM OLD.issued OR NEW.actual_qty IS DISTINCT FROM OLD.actual_qty)) THEN
        RAISE EXCEPTION 'Reserved issue requirements cannot be changed'; END IF;
    ELSE
      IF NEW.item_code IS DISTINCT FROM OLD.item_code OR NEW.unit IS DISTINCT FROM OLD.unit
        OR NEW.planned_qty IS DISTINCT FROM OLD.planned_qty OR NEW.packaging_sku_id IS DISTINCT FROM OLD.packaging_sku_id THEN
        RAISE EXCEPTION 'Reserved packaging requirements cannot be changed'; END IF;
    END IF;
  END IF;
  IF TG_TABLE_NAME='production_order_materials' AND TG_OP='UPDATE' THEN
    IF NEW.issued AND NOT coalesce(OLD.issued,false)
      AND EXISTS(SELECT 1 FROM pd_warehouse_issue_orders WHERE order_id=oid AND enabled)
      AND NOT EXISTS(SELECT 1 FROM pd_warehouse_reservations WHERE order_id=oid) THEN
      RAISE EXCEPTION 'Use the warehouse-stock approval RPC for this order'; END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_pd_warehouse_requirements() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_pd_material_requirements BEFORE INSERT OR UPDATE OR DELETE ON public.production_order_materials
FOR EACH ROW EXECUTE FUNCTION public.guard_pd_warehouse_requirements();
CREATE TRIGGER guard_pd_packaging_requirements BEFORE INSERT OR UPDATE OR DELETE ON public.production_order_packaging
FOR EACH ROW EXECUTE FUNCTION public.guard_pd_warehouse_requirements();
COMMIT;
