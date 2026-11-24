"""Run candidate SQL only in disposable PostgreSQL; never connects to Sage/Supabase."""
from pathlib import Path
from tempfile import mkdtemp
from uuid import uuid4
import psycopg
from pgserver import get_server

# Keep socket and lock files inside the disposable test directory on macOS too.
from fasteners import InterProcessLock
from pgserver.postgres_server import PostgresServer

runtime = Path(mkdtemp(prefix='pd-socket-', dir='/tmp'))
PostgresServer.runtime_path = runtime
PostgresServer._lock = InterProcessLock(runtime / '.lockfile')
server=get_server(Path(mkdtemp(prefix='pd-warehouse-tests-')),cleanup_mode='delete')
try:
 with psycopg.connect(server.get_uri('postgres'),autocommit=True) as db:
  db.execute('''
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
    CREATE TABLE profiles(id uuid PRIMARY KEY,role text);
    CREATE TABLE formulations(id uuid PRIMARY KEY,status text);
    CREATE TABLE production_orders(id uuid PRIMARY KEY,status text,planned_qty numeric,formulation_id uuid,approved_by uuid,approved_at timestamptz);
    CREATE TABLE raw_materials(id uuid PRIMARY KEY,code text,sage_code text,cost_per_unit numeric,current_stock numeric);
    CREATE TABLE raw_material_lots(id uuid,qty_remaining numeric);
    CREATE TABLE production_order_materials(id uuid PRIMARY KEY,production_order_id uuid,raw_material_id uuid,planned_qty numeric,unit text,issued boolean DEFAULT false,actual_qty numeric,issued_by uuid,issued_at timestamptz,unit_cost numeric,total_cost numeric);
    CREATE TABLE production_order_packaging(id uuid PRIMARY KEY,production_order_id uuid,item_code text,planned_qty numeric,unit text,packaging_sku_id uuid);
    CREATE TABLE quality_lot_controls(raw_material_id uuid,disposition text);
    CREATE TABLE sync_log(reference_id uuid,reference_type text,event_type text,status text,updated_at timestamptz DEFAULT now(),details jsonb);
    CREATE FUNCTION record_production_daily_issues_once(uuid) RETURNS integer LANGUAGE sql AS $$ SELECT 1 $$;
    CREATE FUNCTION log_approval_action(text,uuid,text,text,text,uuid,text) RETURNS void LANGUAGE sql AS $$ SELECT $$;
    CREATE FUNCTION test_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.status='materials_issued' AND OLD.status<>NEW.status THEN
        INSERT INTO sync_log(reference_id,reference_type,event_type,status) VALUES(NEW.id,'production_orders','materials_issued','pending');
      END IF; RETURN NEW; END $$;
    CREATE TRIGGER issue_event AFTER UPDATE ON production_orders FOR EACH ROW EXECUTE FUNCTION test_event();
  ''')
  db.execute(Path('outputs/pd-stock-mode-candidate/setup.sql').read_text())
  actor,formula,rm,order,line,pack= [uuid4() for _ in range(6)]
  db.execute("SELECT set_config('test.uid',%s,false)",(str(actor),))
  db.execute("INSERT INTO profiles VALUES(%s,'finance')",(actor,))
  db.execute("INSERT INTO formulations VALUES(%s,'active')",(formula,))
  db.execute("INSERT INTO raw_materials VALUES(%s,'A','A',2,1000)",(rm,))
  db.execute("INSERT INTO raw_material_lots VALUES(%s,1000)",(uuid4(),))
  def seed(order,line,qty=6):
   db.execute("INSERT INTO production_orders VALUES(%s,'pending_finance',%s,%s,NULL,NULL)",(order,qty,formula))
   db.execute("INSERT INTO production_order_materials(id,production_order_id,raw_material_id,planned_qty,unit) VALUES(%s,%s,%s,%s,'kg')",(line,order,rm,qty))
   db.execute("INSERT INTO production_order_packaging VALUES(%s,%s,'BAG',1,'bags',%s)",(uuid4(),order,uuid4()))
   db.execute("INSERT INTO pd_warehouse_issue_orders VALUES(%s,true,'Hyperfeeds 2026 UAT',19,'Scoped test')",(order,))
  seed(order,line)
  for code,unit in [('A','kg'),('BAG','bags')]:
   db.execute("INSERT INTO pd_warehouse_item_policy(sage_code,warehouse_mode_allowed,unit,lot_controlled,review_note) VALUES(%s,true,%s,false,'Test reviewed')",(code,unit))
   db.execute("INSERT INTO pd_verified_stock VALUES(%s,19,'Hyperfeeds 2026 UAT',10,%s,false,true,clock_timestamp(),'fixture')",(code,unit))
  def preview(oid=order):return db.execute('SELECT preview_pd_warehouse_issue(%s)',(oid,)).fetchone()[0]
  def issue(oid=order):return db.execute('SELECT approve_pd_warehouse_issue(%s)',(oid,)).fetchone()[0]
  assert preview()['ready']
  db.execute('SELECT request_pd_warehouse_stock_refresh(%s)',(order,))
  db.execute('SELECT request_pd_warehouse_stock_refresh(%s)',(order,))
  assert db.execute("SELECT details->'itemCodes' FROM sync_log WHERE event_type='sage_stock_refresh'").fetchall()==[(['A','BAG'],)]
  db.execute("DELETE FROM sync_log WHERE event_type='sage_stock_refresh'")
  db.execute("SELECT publish_verified_pd_stock('A',10,clock_timestamp())")
  db.execute("SELECT publish_verified_pd_stock('A',0,clock_timestamp()-interval '30 seconds')")
  assert preview()['ready'] # an older response cannot replace newer availability
  db.execute("UPDATE pd_warehouse_item_policy SET lot_controlled=true WHERE sage_code='A'")
  db.execute("SELECT publish_verified_pd_stock('A',10,clock_timestamp())")
  assert not preview()['ready'] # reviewed lot control is carried into the verified stock record
  assert db.execute("SELECT lot_controlled FROM pd_verified_stock WHERE sage_code='A'").fetchone()[0]
  db.execute("UPDATE pd_warehouse_item_policy SET lot_controlled=false WHERE sage_code='A'")
  db.execute("SELECT publish_verified_pd_stock('A',10,clock_timestamp())")
  assert preview()['ready']
  for update,restore in [
    ("lot_controlled=true","lot_controlled=false"),
    ("wip_verified=false","wip_verified=true"),
    ("observed_at=now()-interval '3 minutes'","observed_at=clock_timestamp()"),
    ("observed_at=now()+interval '3 minutes'","observed_at=clock_timestamp()"),
    ("unit='bags'","unit='kg'"),
    ("available_quantity=0","available_quantity=10")]:
   db.execute("UPDATE pd_verified_stock SET "+update+" WHERE sage_code='A'")
   assert not preview()['ready'],update
   try:issue();raise AssertionError('Issue should fail: '+update)
   except psycopg.errors.RaiseException:pass
   assert db.execute('SELECT count(*) FROM pd_warehouse_reservations').fetchone()[0]==0
   db.execute("UPDATE pd_verified_stock SET "+restore+" WHERE sage_code='A'")
  db.execute("INSERT INTO quality_lot_controls VALUES(%s,'hold')",(rm,))
  assert not preview()['ready']; db.execute('DELETE FROM quality_lot_controls')
  db.execute("UPDATE profiles SET role='operator'")
  try:issue();raise AssertionError('Role should fail')
  except psycopg.errors.RaiseException:pass
  db.execute("UPDATE profiles SET role='finance'")
  assert issue()==1
  assert db.execute('SELECT count(*) FROM pd_warehouse_reservations').fetchone()[0]==2
  assert db.execute('SELECT count(*) FROM sync_log').fetchone()[0]==1
  assert db.execute('SELECT current_stock FROM raw_materials').fetchone()[0]==1000
  assert db.execute('SELECT qty_remaining FROM raw_material_lots').fetchone()[0]==1000
  try:issue();raise AssertionError('Duplicate issue should fail')
  except psycopg.errors.RaiseException:pass
  try:
   db.execute('UPDATE production_order_materials SET planned_qty=7 WHERE id=%s',(line,))
   raise AssertionError('Reserved edit should fail')
  except psycopg.errors.RaiseException:pass
  other,otherline=uuid4(),uuid4();seed(other,otherline)
  assert not preview(other)['ready'] # two orders cannot spend the same snapshot
  db.execute("UPDATE sync_log SET status='failed'")
  assert not preview(other)['ready'] # failed is not proof of no Sage posting
  db.execute("UPDATE sync_log SET status='success',updated_at=clock_timestamp()")
  assert not preview(other)['ready'] # stale snapshot cannot release a reservation
  db.execute("UPDATE pd_verified_stock SET available_quantity=4,observed_at=clock_timestamp() WHERE sage_code='A'")
  assert not preview(other)['ready'] # fresh net Sage stock remains insufficient
  db.execute("UPDATE pd_verified_stock SET available_quantity=10,observed_at=clock_timestamp()")
  assert preview(other)['ready'];assert issue(other)==1
  print('PASS: roles, lot/WIP/unit/quality guards, freshness, shortages, atomic issue, packaging reservations, no RM/lot writes, retries, immutable requirements and cross-order reservations')
finally: server.cleanup()
