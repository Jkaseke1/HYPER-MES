import { useState, useEffect } from 'react';
import { Plus, Search, Eye, Package, Calendar, Clock, FileText, Truck, Warehouse, User, Hash, DollarSign, Scale, X } from 'lucide-react';
import GRNApprovalButtons from '../components/approval/GRNApprovalButtons';
import ApprovalHistory from '../components/approval/ApprovalHistory';
import GRNAttachments from '../components/grn/GRNAttachments';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { GoodsReceivedNote, Supplier, RawMaterial } from '../types/database';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import StatCard from '../components/ui/StatCard';
import StockTakeFrozenBanner from '../components/stock/StockTakeFrozenBanner';
import toast from 'react-hot-toast';

interface GRNItem {
  raw_material_id: string;
  ordered_qty: number;
  received_qty: number;
  unit_cost: number;
  batch_number: string;
  expiry_date: string;
}

const emptyItem: GRNItem = {
  raw_material_id: '',
  ordered_qty: 0,
  received_qty: 0,
  unit_cost: 0,
  batch_number: '',
  expiry_date: '',
};

export default function GoodsReceivedPage() {
  const { profile } = useAuth();
  const [grns, setGrns] = useState<GoodsReceivedNote[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewing, setViewing] = useState<GoodsReceivedNote | null>(null);
  const [viewItems, setViewItems] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [supplierId, setSupplierId] = useState('');
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [weighBridgeTicketId, setWeighBridgeTicketId] = useState('');
  const [wbTickets, setWbTickets] = useState<any[]>([]);
  const [items, setItems] = useState<GRNItem[]>([emptyItem]);

  // Weigh bridge inline form fields
  const [wbForm, setWbForm] = useState({
    transaction_no: '',
    vehicle_reg: '',
    haulier_code: 'HYPER',
    product_code: '',
    comment: '',
    trailer_number: '',
    driver_name: '',
    driver_id: '',
    time_in: '',
    first_mass: '',
    time_out: '',
    second_mass: '',
    nett_mass: '',
    driver_signed: false,
  });

  async function fetchData() {
    setLoading(true);
    const [grnsRes, suppliersRes, materialsRes, wbRes] = await Promise.all([
      supabase.from('goods_received_notes').select('*, suppliers(name), warehouses(name), approver:profiles!approved_by(full_name)').order('created_at', { ascending: false }),
      supabase.from('suppliers').select('*').eq('is_active', true).order('name'),
      supabase.from('raw_materials').select('*').eq('is_active', true).order('name'),
      supabase.from('weigh_bridge_tickets').select('*').eq('status', 'open').order('created_at', { ascending: false }),
    ]);
    setGrns(grnsRes.data || []);
    setSuppliers(suppliersRes.data || []);
    setMaterials(materialsRes.data || []);
    setWbTickets(wbRes.data || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
  }, []);

  const generateGRNNumber = async () => {
    const year = new Date().getFullYear();
    const { data: existing } = await supabase
      .from('goods_received_notes')
      .select('grn_number')
      .like('grn_number', `GRN-${year}-%`)
      .order('grn_number', { ascending: false })
      .limit(1);

    let nextNum = 1;
    if (existing && existing.length > 0) {
      const lastNum = parseInt(existing[0].grn_number.split('-')[2]);
      nextNum = lastNum + 1;
    }

    return `GRN-${year}-${String(nextNum).padStart(3, '0')}`;
  };

  const handleSaveGRN = async () => {
    if (!supplierId || items.length === 0 || !items[0].raw_material_id) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      const grnNumber = await generateGRNNumber();
      
      // Get warehouse ID
      const { data: warehouse } = await supabase
        .from('warehouses')
        .select('id')
        .eq('code', 'RM')
        .single();

      // Create GRN header
      const grnData: any = {
        grn_number: grnNumber,
        supplier_id: supplierId,
        warehouse_id: warehouse?.id,
        received_date: receivedDate,
        status: 'pending',
        notes: notes || null,
        received_by: profile?.id,
      };

      if (weighBridgeTicketId) {
        grnData.weigh_bridge_ticket_id = weighBridgeTicketId;
      }

      // Add weigh bridge fields if any are filled
      if (wbForm.transaction_no) grnData.wb_transaction_no = wbForm.transaction_no;
      if (wbForm.vehicle_reg) grnData.wb_vehicle_reg = wbForm.vehicle_reg;
      if (wbForm.haulier_code) grnData.wb_haulier_code = wbForm.haulier_code;
      if (wbForm.product_code) grnData.wb_product_code = wbForm.product_code;
      if (wbForm.comment) grnData.wb_comment = wbForm.comment;
      if (wbForm.trailer_number) grnData.wb_trailer_number = wbForm.trailer_number;
      if (wbForm.driver_name) grnData.wb_driver_name = wbForm.driver_name;
      if (wbForm.driver_id) grnData.wb_driver_id = wbForm.driver_id;
      if (wbForm.time_in) grnData.wb_time_in = wbForm.time_in;
      if (wbForm.first_mass) grnData.wb_first_mass = parseFloat(wbForm.first_mass);
      if (wbForm.time_out) grnData.wb_time_out = wbForm.time_out;
      if (wbForm.second_mass) grnData.wb_second_mass = parseFloat(wbForm.second_mass);
      if (wbForm.nett_mass) grnData.wb_nett_mass = parseFloat(wbForm.nett_mass);
      grnData.wb_driver_signed = wbForm.driver_signed;

      const { data: grn, error: grnError } = await supabase
        .from('goods_received_notes')
        .insert(grnData)
        .select()
        .single();

      if (grnError) throw grnError;

      // Mark WB ticket as linked if selected
      if (weighBridgeTicketId) {
        await supabase.from('weigh_bridge_tickets').update({ status: 'linked' }).eq('id', weighBridgeTicketId);
      }

      // Create GRN items
      const grnItems = items.map(item => ({
        grn_id: grn.id,
        raw_material_id: item.raw_material_id,
        ordered_qty: item.ordered_qty,
        received_qty: item.received_qty,
        unit_cost: item.unit_cost,
        batch_number: item.batch_number || null,
        expiry_date: item.expiry_date || null,
      }));

      const { error: itemsError } = await supabase
        .from('grn_items')
        .insert(grnItems);

      if (itemsError) throw itemsError;

      toast.success('GRN created successfully');
      setModalOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error('Error creating GRN:', error);
      toast.error(`Failed to create GRN: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setSupplierId('');
    setReceivedDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setWeighBridgeTicketId('');
    setItems([emptyItem]);
    setWbForm({
      transaction_no: '', vehicle_reg: '', haulier_code: 'HYPER', product_code: '',
      comment: '', trailer_number: '', driver_name: '', driver_id: '',
      time_in: '', first_mass: '', time_out: '', second_mass: '', nett_mass: '', driver_signed: false,
    });
  };

  const handleViewGRN = async (grn: GoodsReceivedNote) => {
    setViewing(grn);
    const { data } = await supabase
      .from('grn_items')
      .select('*, raw_materials(code, name)')
      .eq('grn_id', grn.id);
    setViewItems(data || []);
    setViewModalOpen(true);
  };

  const addItem = () => {
    setItems([...items, { ...emptyItem }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof GRNItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'secondary',
      approved: 'default',
      rejected: 'destructive',
    };
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  };

  const filteredGRNs = grns.filter(grn =>
    grn.grn_number.toLowerCase().includes(search.toLowerCase()) ||
    grn.suppliers?.name.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: grns.length,
    pending: grns.filter(g => g.status === 'pending').length,
    approved: grns.filter(g => g.status === 'approved').length,
    thisMonth: grns.filter(g => {
      const grnDate = new Date(g.created_at);
      const now = new Date();
      return grnDate.getMonth() === now.getMonth() && grnDate.getFullYear() === now.getFullYear();
    }).length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <StockTakeFrozenBanner />
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Goods Received Notes</h1>
          <p className="text-muted-foreground mt-1">Manage incoming raw material deliveries</p>
        </div>
        <Button onClick={() => setModalOpen(true)} size="lg">
          <Plus className="mr-2 h-4 w-4" />
          New GRN
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard icon={Package} title="Total GRNs" value={stats.total} subtitle="All time" color="blue" />
        <StatCard icon={Clock} title="Pending" value={stats.pending} subtitle="Awaiting approval" color="amber" />
        <StatCard icon={FileText} title="Approved" value={stats.approved} subtitle="Ready to receive" color="emerald" />
        <StatCard icon={Calendar} title="This Month" value={stats.thisMonth} subtitle="Current period" color="teal" />
      </div>

      {/* Search */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by GRN number or supplier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* GRNs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent GRNs</CardTitle>
          <CardDescription>View and manage all goods received notes</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>GRN Number</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Weigh Bridge</TableHead>
                <TableHead>Received Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created By</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredGRNs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No GRNs found
                  </TableCell>
                </TableRow>
              ) : (
                filteredGRNs.map((grn) => (
                  <TableRow key={grn.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {(grn as any).wb_transaction_no && (
                          <span title="Weigh Bridge data captured"><Scale className="w-3.5 h-3.5 text-teal-500 shrink-0" /></span>
                        )}
                        <span className="font-mono text-xs text-slate-500">{grn.grn_number}</span>
                      </div>
                    </TableCell>
                    <TableCell>{grn.suppliers?.name}</TableCell>
                    <TableCell className="text-slate-600 font-mono text-xs">{(grn as any).wb_transaction_no || (grn as any).weigh_bridge_ticket_no || '-'}</TableCell>
                    <TableCell>{format(new Date(grn.received_date), 'PPP')}</TableCell>
                    <TableCell>{getStatusBadge(grn.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(grn.created_at), 'PPp')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewGRN(grn)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create GRN Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-[1320px] w-[98vw] h-[94vh] max-h-[94vh] p-0 sm:!max-w-[1320px] flex flex-col [&>button.absolute]:hidden">
          <DialogHeader className="shrink-0 border-b bg-slate-900 text-white px-5 py-3 rounded-t-lg relative">
            <div className="flex items-center justify-between pr-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg">
                  <Package className="w-5 h-5 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold tracking-tight">Create New GRN</DialogTitle>
                  <DialogDescription className="text-slate-400 text-xs">
                    Add a new goods received note and optionally link a weigh bridge ticket
                  </DialogDescription>
                </div>
              </div>
              <Badge variant="secondary" className="text-xs px-2.5 py-0.5 bg-white/15 text-white border border-white/20 hover:bg-white/20">
                Draft
              </Badge>
            </div>
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="space-y-4">
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                <div className="xl:col-span-8 rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                  <div className="text-sm font-semibold text-slate-700">GRN Header</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="supplier">Supplier *</Label>
                      <Select value={supplierId} onValueChange={setSupplierId}>
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Select supplier" />
                        </SelectTrigger>
                        <SelectContent>
                          {suppliers.map((supplier) => (
                            <SelectItem key={supplier.id} value={supplier.id}>
                              {supplier.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="received_date">Received Date *</Label>
                      <Input
                        id="received_date"
                        type="date"
                        value={receivedDate}
                        onChange={(e) => setReceivedDate(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="xl:col-span-4 rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-1.5">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Additional notes or comments..."
                    rows={4}
                    className="bg-white"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-teal-300 bg-teal-50/40 p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <Scale className="w-4 h-4 text-teal-700" />
                  <h3 className="text-sm font-semibold text-slate-800">Weigh Bridge Ticket</h3>
                  <span className="text-xs text-slate-500">optional — pick existing or fill manually</span>
                </div>

                <div className="flex flex-col md:flex-row md:items-center gap-2">
                  <Select
                    value={weighBridgeTicketId}
                    onValueChange={(val) => {
                      setWeighBridgeTicketId(val);
                      const ticket = wbTickets.find((t: any) => t.id === val);
                      if (ticket) {
                        setWbForm({
                          transaction_no: ticket.ticket_no || '',
                          vehicle_reg: ticket.vehicle_reg || '',
                          haulier_code: ticket.haulier_code || 'HYPER',
                          product_code: ticket.product_code || '',
                          comment: ticket.comment || '',
                          trailer_number: ticket.trailer_number || '',
                          driver_name: ticket.driver_name || '',
                          driver_id: ticket.driver_id || '',
                          time_in: ticket.time_in ? ticket.time_in.slice(0, 16) : '',
                          first_mass: ticket.first_mass != null ? String(ticket.first_mass) : '',
                          time_out: ticket.time_out ? ticket.time_out.slice(0, 16) : '',
                          second_mass: ticket.second_mass != null ? String(ticket.second_mass) : '',
                          nett_mass: ticket.nett_mass != null ? String(ticket.nett_mass) : '',
                          driver_signed: ticket.driver_signed || false,
                        });
                      }
                    }}
                  >
                    <SelectTrigger className="md:flex-1 bg-white">
                      <SelectValue placeholder="Select an existing ticket..." />
                    </SelectTrigger>
                    <SelectContent>
                      {wbTickets.map((t: any) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.ticket_no} | {t.vehicle_reg || 'No reg'} | {t.nett_mass != null ? `${t.nett_mass} kg` : 'No mass'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {weighBridgeTicketId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setWeighBridgeTicketId('');
                        setWbForm({
                          transaction_no: '', vehicle_reg: '', haulier_code: 'HYPER', product_code: '',
                          comment: '', trailer_number: '', driver_name: '', driver_id: '',
                          time_in: '', first_mass: '', time_out: '', second_mass: '', nett_mass: '', driver_signed: false,
                        });
                      }}
                      className="text-slate-600 hover:text-red-600 shrink-0"
                    >
                      Clear
                    </Button>
                  )}
                </div>
                {wbTickets.length === 0 && (
                  <p className="text-xs text-slate-500">No open WB tickets. Go to <strong>Weigh Bridge</strong> to create one first.</p>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                  <div className="lg:col-span-4 space-y-1.5">
                    <Label className="text-xs">Ticket No</Label>
                    <Input value={wbForm.transaction_no} onChange={(e) => setWbForm({ ...wbForm, transaction_no: e.target.value })} placeholder="WB-001" className="bg-white" />
                  </div>
                  <div className="lg:col-span-4 space-y-1.5">
                    <Label className="text-xs">Vehicle Reg</Label>
                    <Input value={wbForm.vehicle_reg} onChange={(e) => setWbForm({ ...wbForm, vehicle_reg: e.target.value })} placeholder="ABC-1234" className="bg-white" />
                  </div>
                  <div className="lg:col-span-4 space-y-1.5">
                    <Label className="text-xs">Haulier</Label>
                    <Input value={wbForm.haulier_code} onChange={(e) => setWbForm({ ...wbForm, haulier_code: e.target.value })} className="bg-white" />
                  </div>

                  <div className="lg:col-span-4 space-y-1.5">
                    <Label className="text-xs">Product Code</Label>
                    <Input value={wbForm.product_code} onChange={(e) => setWbForm({ ...wbForm, product_code: e.target.value })} className="bg-white" />
                  </div>
                  <div className="lg:col-span-4 space-y-1.5">
                    <Label className="text-xs">Trailer No</Label>
                    <Input value={wbForm.trailer_number} onChange={(e) => setWbForm({ ...wbForm, trailer_number: e.target.value })} className="bg-white" />
                  </div>
                  <div className="lg:col-span-4 space-y-1.5">
                    <Label className="text-xs">Driver Name</Label>
                    <Input value={wbForm.driver_name} onChange={(e) => setWbForm({ ...wbForm, driver_name: e.target.value })} className="bg-white" />
                  </div>

                  <div className="lg:col-span-3 space-y-1.5">
                    <Label className="text-xs">Time In</Label>
                    <Input type="datetime-local" value={wbForm.time_in} onChange={(e) => setWbForm({ ...wbForm, time_in: e.target.value })} className="bg-white" />
                  </div>
                  <div className="lg:col-span-3 space-y-1.5">
                    <Label className="text-xs">First Mass (kg)</Label>
                    <Input type="number" value={wbForm.first_mass} onChange={(e) => setWbForm({ ...wbForm, first_mass: e.target.value })} className="bg-white" />
                  </div>
                  <div className="lg:col-span-3 space-y-1.5">
                    <Label className="text-xs">Time Out</Label>
                    <Input type="datetime-local" value={wbForm.time_out} onChange={(e) => setWbForm({ ...wbForm, time_out: e.target.value })} className="bg-white" />
                  </div>
                  <div className="lg:col-span-3 space-y-1.5">
                    <Label className="text-xs">Second Mass (kg)</Label>
                    <Input type="number" value={wbForm.second_mass} onChange={(e) => setWbForm({ ...wbForm, second_mass: e.target.value })} className="bg-white" />
                  </div>

                  <div className="lg:col-span-4 space-y-1.5">
                    <Label className="text-xs">Nett Mass (kg)</Label>
                    <Input type="number" value={wbForm.nett_mass} onChange={(e) => setWbForm({ ...wbForm, nett_mass: e.target.value })} className="bg-white" />
                  </div>
                  <div className="lg:col-span-4 space-y-1.5">
                    <Label className="text-xs">Driver ID</Label>
                    <Input value={wbForm.driver_id} onChange={(e) => setWbForm({ ...wbForm, driver_id: e.target.value })} className="bg-white" />
                  </div>
                  <div className="lg:col-span-4 flex items-end pb-1">
                    <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-slate-300 bg-white">
                      <input
                        type="checkbox"
                        id="wb_driver_signed"
                        checked={wbForm.driver_signed}
                        onChange={(e) => setWbForm({ ...wbForm, driver_signed: e.target.checked })}
                        className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      />
                      <Label htmlFor="wb_driver_signed" className="text-xs">Driver Signed</Label>
                    </div>
                  </div>

                  <div className="lg:col-span-12 space-y-1.5">
                    <Label className="text-xs">Comment</Label>
                    <Input value={wbForm.comment} onChange={(e) => setWbForm({ ...wbForm, comment: e.target.value })} placeholder="Optional comment..." className="bg-white" />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Line Items</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addItem}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Item
                  </Button>
                </div>

                {items.map((item, index) => (
                  <Card key={index} className="border-slate-200">
                    <CardContent className="pt-4 space-y-3">
                      <div className="space-y-2">
                        <Label>Raw Material *</Label>
                        <Select
                          value={item.raw_material_id}
                          onValueChange={(value) => updateItem(index, 'raw_material_id', value)}
                        >
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Select material" />
                          </SelectTrigger>
                          <SelectContent>
                            {materials.map((material) => (
                              <SelectItem key={material.id} value={material.id}>
                                {material.code} - {material.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Ordered Qty</Label>
                          <Input
                            type="number"
                            value={item.ordered_qty}
                            onChange={(e) => updateItem(index, 'ordered_qty', Number(e.target.value))}
                            step="0.01"
                            className="bg-white"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Received Qty *</Label>
                          <Input
                            type="number"
                            value={item.received_qty}
                            onChange={(e) => updateItem(index, 'received_qty', Number(e.target.value))}
                            step="0.01"
                            className="bg-white"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Unit Cost</Label>
                          <Input
                            type="number"
                            value={item.unit_cost}
                            onChange={(e) => updateItem(index, 'unit_cost', Number(e.target.value))}
                            step="0.01"
                            className="bg-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Batch Number</Label>
                          <Input
                            value={item.batch_number}
                            onChange={(e) => updateItem(index, 'batch_number', e.target.value)}
                            className="bg-white"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Expiry Date</Label>
                          <Input
                            type="date"
                            value={item.expiry_date}
                            onChange={(e) => updateItem(index, 'expiry_date', e.target.value)}
                            className="bg-white"
                          />
                        </div>
                      </div>

                      {items.length > 1 && (
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => removeItem(index)}
                          >
                            Remove
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>

          <div className="shrink-0 flex justify-end gap-2 border-t bg-white px-5 py-3">
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSaveGRN} disabled={saving}>
              {saving ? 'Creating...' : 'Create GRN'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View GRN Modal */}
      <Dialog open={viewModalOpen} onOpenChange={setViewModalOpen}>
        <DialogContent className="max-w-[1320px] w-[98vw] h-[94vh] max-h-[94vh] p-0 sm:!max-w-[1320px] flex flex-col [&>button.absolute]:hidden">
          {/* Header Banner */}
          <div className="bg-slate-900 text-white px-5 py-3 rounded-t-lg flex-shrink-0 relative">
            <div className="flex items-center justify-between pr-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg">
                  <Package className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold tracking-tight">{viewing?.grn_number}</h2>
                  <p className="text-slate-400 text-xs">
                    <Calendar className="w-3 h-3 inline mr-1" />
                    Received {viewing && format(new Date(viewing.received_date), 'PPP')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {viewing && (
                  <Badge
                    variant={viewing.status === 'approved' ? 'default' : viewing.status === 'rejected' ? 'destructive' : 'secondary'}
                    className="text-sm px-3 py-1 capitalize"
                  >
                    {viewing.status}
                  </Badge>
                )}
              </div>
            </div>
            {/* Close Button */}
            <button
              onClick={() => setViewModalOpen(false)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Approval Actions */}
          {viewing && viewing.status === 'pending' && (
            <div className="flex-shrink-0 px-5 py-2 bg-white border-b border-slate-200">
              <GRNApprovalButtons
                grnId={viewing.id}
                currentStatus={viewing.status}
                onApproved={() => { setViewModalOpen(false); fetchData(); }}
                onRejected={() => { setViewModalOpen(false); fetchData(); }}
              />
            </div>
          )}

          {/* Rejection Reason */}
          {viewing && (viewing as any).rejection_reason && (
            <div className="flex-shrink-0 mx-5 mt-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <p className="text-xs font-semibold text-red-800">Rejection: <span className="font-normal text-red-700">{(viewing as any).rejection_reason}</span></p>
            </div>
          )}

          {/* Main Content - Two Column */}
          <div className="flex-1 overflow-y-auto px-5 py-3">
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 h-full">
              {/* Left Column: Info + Weigh Bridge */}
              <div className="xl:col-span-4 space-y-2">
                {/* Supplier / Warehouse / Created - compact inline */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="border-l-3 border-l-blue-500 bg-white rounded-lg border border-slate-200 p-2.5">
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Supplier</p>
                    <p className="text-xs font-semibold text-slate-800 mt-0.5">{viewing?.suppliers?.name || 'N/A'}</p>
                  </div>
                  <div className="border-l-3 border-l-amber-500 bg-white rounded-lg border border-slate-200 p-2.5">
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Warehouse</p>
                    <p className="text-xs font-semibold text-slate-800 mt-0.5">{viewing?.warehouses?.name || 'N/A'}</p>
                  </div>
                </div>
                <div className="border-l-3 border-l-emerald-500 bg-white rounded-lg border border-slate-200 p-2.5">
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Created</p>
                  <p className="text-xs font-semibold text-slate-800 mt-0.5">{viewing && format(new Date(viewing.created_at), 'PPP')}</p>
                </div>

                {/* Weigh Bridge Ticket */}
                {viewing && (viewing as any).wb_transaction_no && (
                  <div className="bg-white rounded-lg border border-teal-200 p-2.5">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Scale className="w-3.5 h-3.5 text-teal-600" />
                      <h3 className="text-xs font-semibold text-slate-700">Weigh Bridge Ticket</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                      <div><span className="text-slate-400">Ticket:</span> <span className="font-mono text-slate-800">{(viewing as any).wb_transaction_no}</span></div>
                      <div><span className="text-slate-400">Vehicle:</span> <span className="text-slate-800">{(viewing as any).wb_vehicle_reg || '-'}</span></div>
                      <div><span className="text-slate-400">Haulier:</span> <span className="text-slate-800">{(viewing as any).wb_haulier_code || '-'}</span></div>
                      <div><span className="text-slate-400">Driver:</span> <span className="text-slate-800">{(viewing as any).wb_driver_name || '-'}</span></div>
                      <div><span className="text-slate-400">1st Mass:</span> <span className="text-slate-800">{(viewing as any).wb_first_mass != null ? `${(viewing as any).wb_first_mass} kg` : '-'}</span></div>
                      <div><span className="text-slate-400">2nd Mass:</span> <span className="text-slate-800">{(viewing as any).wb_second_mass != null ? `${(viewing as any).wb_second_mass} kg` : '-'}</span></div>
                      <div><span className="text-slate-400">Nett:</span> <span className="font-semibold text-teal-700">{(viewing as any).wb_nett_mass != null ? `${(viewing as any).wb_nett_mass} kg` : '-'}</span></div>
                      <div><span className="text-slate-400">Signed:</span> <span className="text-slate-800">{(viewing as any).wb_driver_signed ? 'Yes' : 'No'}</span></div>
                    </div>
                    {(viewing as any).wb_comment && (
                      <p className="text-[10px] text-slate-500 mt-1.5 italic">{(viewing as any).wb_comment}</p>
                    )}
                  </div>
                )}

                {/* Notes */}
                {viewing?.notes && (
                  <div className="bg-amber-50/60 rounded-lg border border-amber-200 p-2.5">
                    <div className="flex items-start gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                      <p className="text-xs text-slate-700">{viewing.notes}</p>
                    </div>
                  </div>
                )}

                {/* Approval History & Attachments - compact */}
                {viewing && (
                  <div className="space-y-1.5 pt-1">
                    <details className="bg-white rounded-lg border border-slate-200">
                      <summary className="cursor-pointer text-xs font-semibold text-slate-600 px-2.5 py-1.5">Approval History</summary>
                      <div className="px-2.5 pb-2">
                        <ApprovalHistory entityType="grn" entityId={viewing.id} />
                      </div>
                    </details>
                    <details className="bg-white rounded-lg border border-slate-200">
                      <summary className="cursor-pointer text-xs font-semibold text-slate-600 px-2.5 py-1.5">Attachments</summary>
                      <div className="px-2.5 pb-2">
                        <GRNAttachments grnId={viewing.id} />
                      </div>
                    </details>
                  </div>
                )}
              </div>

              {/* Right Column: Line Items + Totals */}
              <div className="xl:col-span-8 flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                  <Scale className="w-4 h-4 text-slate-600" />
                  <h3 className="text-sm font-bold text-slate-800">Line Items</h3>
                  <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">{viewItems.length} item{viewItems.length !== 1 ? 's' : ''}</span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm flex-1 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50 hover:bg-slate-50">
                        <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider py-2 px-3">Material</TableHead>
                        <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right py-2 px-3 w-[80px]">Ordered</TableHead>
                        <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right py-2 px-3 w-[80px]">Received</TableHead>
                        <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right py-2 px-3 w-[80px]">Unit Cost</TableHead>
                        <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right py-2 px-3 w-[90px]">Line Total</TableHead>
                        <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider py-2 px-3 w-[100px]">Batch</TableHead>
                        <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider py-2 px-3 w-[90px]">Expiry</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewItems.map((item, index) => (
                        <TableRow key={index} className="hover:bg-slate-50/50">
                          <TableCell className="py-2 px-3">
                            <div>
                              <p className="text-xs font-semibold text-slate-800">{item.raw_materials?.name}</p>
                              <p className="text-[10px] text-slate-500 font-mono">{item.raw_materials?.code}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-right text-slate-600 py-2 px-3">{item.ordered_qty.toLocaleString()} kg</TableCell>
                          <TableCell className="text-xs text-right text-slate-800 py-2 px-3 font-semibold">{item.received_qty.toLocaleString()} kg</TableCell>
                          <TableCell className="text-xs text-right text-slate-600 py-2 px-3">${item.unit_cost.toFixed(2)}</TableCell>
                          <TableCell className="text-xs text-right font-bold text-emerald-700 py-2 px-3">${(item.received_qty * item.unit_cost).toFixed(2)}</TableCell>
                          <TableCell className="text-xs text-slate-600 py-2 px-3">
                            {item.batch_number ? (
                              <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-mono">{item.batch_number}</span>
                            ) : (
                              <span className="text-slate-400 text-[10px]">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-slate-600 py-2 px-3">
                            {item.expiry_date ? format(new Date(item.expiry_date), 'PP') : <span className="text-slate-400 text-[10px]">-</span>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Totals Footer */}
                <div className="mt-2 bg-slate-900 text-white rounded-xl p-3 flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-slate-300">
                      Ordered: <strong className="text-white">{viewItems.reduce((s, i) => s + (i.ordered_qty || 0), 0).toLocaleString()} kg</strong>
                    </span>
                    <div className="w-px h-4 bg-slate-700" />
                    <span className="text-xs text-slate-300">
                      Received: <strong className="text-white">{viewItems.reduce((s, i) => s + (i.received_qty || 0), 0).toLocaleString()} kg</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 bg-emerald-500 px-3 py-1.5 rounded-lg">
                    <DollarSign className="w-4 h-4 text-white" />
                    <div>
                      <p className="text-[10px] text-emerald-100 font-medium">Total Value</p>
                      <p className="text-sm font-bold text-white">${viewItems.reduce((s, i) => s + (i.received_qty || 0) * (i.unit_cost || 0), 0).toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
