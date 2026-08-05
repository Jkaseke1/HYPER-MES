import { useState, useEffect } from 'react';
import { Plus, Search, Eye, Package, Calendar, Clock, FileText, Warehouse, Hash, DollarSign, Scale, X, ChevronDown, ChevronUp } from 'lucide-react';
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
import { cacheData, getCachedData, queueOfflineAction } from '../lib/offlineSync';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import StatCard from '../components/ui/StatCard';
import StockTakeFrozenBanner from '../components/stock/StockTakeFrozenBanner';
import toast from 'react-hot-toast';

interface GRNItem {
  raw_material_id: string;
  ordered_qty: number | '';
  received_qty: number | '';
  unit_cost: number | '';
  batch_number: string;
  expiry_date: string;
}

const emptyItem: GRNItem = {
  raw_material_id: '',
  ordered_qty: '',
  received_qty: '',
  unit_cost: '',
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
  const [wbExpanded, setWbExpanded] = useState(false);
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
    try {
      const [grnsRes, suppliersRes, materialsRes, wbRes] = await Promise.all([
        supabase.from('goods_received_notes').select('*, receiver:profiles!received_by(full_name, email), approver:profiles!approved_by(full_name), suppliers(name), warehouses(name)').order('created_at', { ascending: false }),
        supabase.from('suppliers').select('*').eq('is_active', true).order('name'),
        supabase.from('raw_materials').select('*').eq('is_active', true).order('name'),
        supabase.from('weigh_bridge_tickets').select('*').eq('status', 'open').order('created_at', { ascending: false }),
      ]);

      if (grnsRes.data) {
        setGrns(grnsRes.data as any);
        cacheData('goods_received_notes', grnsRes.data);
      }
      if (suppliersRes.data) {
        setSuppliers(suppliersRes.data as any);
        cacheData('suppliers', suppliersRes.data);
      }
      if (materialsRes.data) {
        setMaterials(materialsRes.data as any);
        cacheData('raw_materials', materialsRes.data);
      }
      if (wbRes.data) {
        setWbTickets(wbRes.data as any);
        cacheData('weigh_bridge_tickets', wbRes.data);
      }

      if (!navigator.onLine || grnsRes.error) {
        const cachedGrns = await getCachedData('goods_received_notes');
        const cachedSuppliers = await getCachedData('suppliers');
        const cachedMaterials = await getCachedData('raw_materials');
        const cachedWb = await getCachedData('weigh_bridge_tickets');

        if (cachedGrns) setGrns(cachedGrns);
        if (cachedSuppliers) setSuppliers(cachedSuppliers);
        if (cachedMaterials) setMaterials(cachedMaterials);
        if (cachedWb) setWbTickets(cachedWb);
      }
    } catch {
      const cachedGrns = await getCachedData('goods_received_notes');
      const cachedSuppliers = await getCachedData('suppliers');
      const cachedMaterials = await getCachedData('raw_materials');
      const cachedWb = await getCachedData('weigh_bridge_tickets');

      if (cachedGrns) setGrns(cachedGrns);
      if (cachedSuppliers) setSuppliers(cachedSuppliers);
      if (cachedMaterials) setMaterials(cachedMaterials);
      if (cachedWb) setWbTickets(cachedWb);
    }
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
        ordered_qty: Number(item.ordered_qty) || 0,
        received_qty: Number(item.received_qty) || 0,
        unit_cost: Number(item.unit_cost) || 0,
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

  const parseLineItemNumber = (value: string): number | '' => {
    if (value === '') return '';
    const parsed = Number(value);
    return Number.isNaN(parsed) ? '' : parsed;
  };

  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-0.5 font-semibold">Approved</Badge>;
      case 'pending':
        return <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/20 border border-amber-500/30 px-2.5 py-0.5 font-semibold">Pending</Badge>;
      case 'rejected':
        return <Badge className="bg-rose-500/15 text-rose-700 hover:bg-rose-500/20 border border-rose-500/30 px-2.5 py-0.5 font-semibold">Rejected</Badge>;
      default:
        return <Badge variant="outline" className="font-semibold">{status}</Badge>;
    }
  };

  const filteredGRNs = grns.filter(grn => {
    const matchesSearch = grn.grn_number.toLowerCase().includes(search.toLowerCase()) ||
      grn.suppliers?.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || grn.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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

  const totalOrderedQty = items.reduce((sum, item) => sum + (Number(item.ordered_qty) || 0), 0);
  const totalReceivedQty = items.reduce((sum, item) => sum + (Number(item.received_qty) || 0), 0);
  const totalReceivedValue = items.reduce(
    (sum, item) => sum + (Number(item.received_qty) || 0) * (Number(item.unit_cost) || 0),
    0
  );
  const wbNettMassValue = Number(wbForm.nett_mass || 0);
  const wbVariancePct = wbNettMassValue > 0 ? Math.abs((totalReceivedQty - wbNettMassValue) / wbNettMassValue) * 100 : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 font-medium animate-pulse">Loading Goods Received Notes...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-[1600px] mx-auto">
      <StockTakeFrozenBanner />
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 p-6 rounded-2xl text-white shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-teal-500/20 text-teal-300 text-xs px-2.5 py-0.5 rounded-full border border-teal-500/30 font-mono font-medium">Inbound Logistics</span>
            <span className="text-slate-400 text-xs">• Sage Synchronized</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Goods Received Notes</h1>
          <p className="text-slate-300 text-sm mt-1">Capture raw material deliveries & automated Sage GRV postings</p>
        </div>
        <Button onClick={() => setModalOpen(true)} size="lg" className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold shadow-lg shadow-emerald-500/20 shrink-0">
          <Plus className="mr-2 h-5 w-5" />
          New GRN Delivery
        </Button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={Package} title="Total GRNs" value={stats.total} subtitle="All time" color="blue" />
        <StatCard icon={Clock} title="Pending Approval" value={stats.pending} subtitle="Awaiting sign-off" color="amber" />
        <StatCard icon={FileText} title="Sage Approved" value={stats.approved} subtitle="Posted to Sage" color="emerald" />
        <StatCard icon={Calendar} title="This Month" value={stats.thisMonth} subtitle="Current period" color="teal" />
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by GRN number or supplier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-slate-50/50 border-slate-200 focus:bg-white"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-all shrink-0 ${
                statusFilter === st
                  ? 'bg-slate-900 text-white shadow'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* GRNs View: Desktop Table + Mobile Card Grid */}
      <Card className="border border-slate-200 shadow-md overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4 px-6">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold text-slate-900">Delivery Register</CardTitle>
              <CardDescription className="text-xs text-slate-500">View, inspect, and approve incoming goods notes</CardDescription>
            </div>
            <Badge variant="outline" className="font-mono text-xs text-slate-600 bg-white">
              {filteredGRNs.length} record(s)
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-100/70 hover:bg-slate-100/70">
                  <TableHead className="font-bold text-slate-700">GRN Number</TableHead>
                  <TableHead className="font-bold text-slate-700">Supplier</TableHead>
                  <TableHead className="font-bold text-slate-700">Weigh Bridge</TableHead>
                  <TableHead className="font-bold text-slate-700">Received Date</TableHead>
                  <TableHead className="font-bold text-slate-700">Initiated By</TableHead>
                  <TableHead className="font-bold text-slate-700">Status</TableHead>
                  <TableHead className="font-bold text-slate-700">Created Date</TableHead>
                  <TableHead className="text-right font-bold text-slate-700 pr-6">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGRNs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-slate-400 py-12">
                      No Goods Received Notes found matching criteria
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredGRNs.map((grn) => (
                    <TableRow key={grn.id} className="hover:bg-slate-50/80 transition-colors">
                      <TableCell className="font-semibold">
                        <div className="flex items-center gap-2">
                          {(grn as any).wb_transaction_no && (
                            <span title="Weigh Bridge data captured"><Scale className="w-4 h-4 text-emerald-600 shrink-0" /></span>
                          )}
                          <span className="font-mono text-xs bg-slate-100 text-slate-800 px-2 py-1 rounded border border-slate-200">{grn.grn_number}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-slate-900">{grn.suppliers?.name}</TableCell>
                      <TableCell className="text-slate-600 font-mono text-xs">{(grn as any).wb_transaction_no || (grn as any).weigh_bridge_ticket_no || '-'}</TableCell>
                      <TableCell className="text-slate-700">{format(new Date(grn.received_date), 'MMM d, yyyy')}</TableCell>
                      <TableCell className="text-xs text-slate-700 font-medium">{(grn as any).receiver?.full_name || (grn as any).receiver?.email || '—'}</TableCell>
                      <TableCell>{getStatusBadge(grn.status)}</TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {format(new Date(grn.created_at), 'MMM d, yyyy • HH:mm')}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewGRN(grn)}
                          className="hover:bg-teal-50 hover:text-teal-700 border-slate-300 font-semibold"
                        >
                          <Eye className="h-4 w-4 mr-1.5 text-teal-600" />
                          Inspect
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card List View (Phones & Tablets) */}
          <div className="block md:hidden divide-y divide-slate-100">
            {filteredGRNs.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                No Goods Received Notes found matching criteria
              </div>
            ) : (
              filteredGRNs.map((grn) => (
                <div key={grn.id} className="p-4 space-y-3 bg-white hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold bg-slate-900 text-white px-2 py-1 rounded">
                        {grn.grn_number}
                      </span>
                      {(grn as any).wb_transaction_no && (
                        <Badge variant="outline" className="text-[10px] text-teal-700 border-teal-300 bg-teal-50">
                          <Scale className="w-3 h-3 mr-1 text-teal-600 inline" /> WB Ticket
                        </Badge>
                      )}
                    </div>
                    {getStatusBadge(grn.status)}
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-900 text-base">{grn.suppliers?.name}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Received: {format(new Date(grn.received_date), 'PPP')}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-[11px] text-slate-400">
                      {format(new Date(grn.created_at), 'MMM d, HH:mm')}
                    </span>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleViewGRN(grn)}
                      className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4"
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" />
                      View Details
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create GRN Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-[1320px] w-[98vw] h-[94vh] max-h-[94vh] p-0 sm:!max-w-[1320px] flex flex-col [&>button.absolute]:hidden">
          {/* Premium Header */}
          <DialogHeader className="shrink-0 bg-gradient-to-r from-[#06061c] via-[#0b0c36] to-[#080829] text-white px-6 py-4 rounded-t-2xl relative overflow-hidden border-b border-orange-500/30">
            {/* Background decorative glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 via-transparent to-amber-500/5 pointer-events-none" />
            <div className="relative flex items-center justify-between pr-10">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/25 ring-2 ring-orange-500/40">
                  <Package className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <DialogTitle className="text-xl font-black tracking-tight text-white">Create New GRN</DialogTitle>
                    <span className="text-[10px] font-extrabold bg-orange-500/20 text-orange-400 border border-orange-500/40 px-2 py-0.5 rounded-full uppercase tracking-wider font-mono">DRAFT</span>
                  </div>
                  <DialogDescription className="text-slate-300 text-xs font-medium">
                    Goods Received Note — Raw Material Inbound · Sage Auto-Post on Approval
                  </DialogDescription>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-3 text-xs text-slate-300">
                <div className="flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/30 px-3 py-1.5 rounded-xl font-mono text-orange-400 font-bold">
                  <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                  Sage Sync Ready
                </div>
              </div>
            </div>
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/25 border border-white/20 flex items-center justify-center transition-colors text-white"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 bg-slate-50" style={{scrollbarWidth:'thin'}}>
            <div className="space-y-4 [&_input]:h-10 [&_[role='combobox']]:h-10 [&_textarea]:min-h-[80px]">

              {/* Section 1: GRN Header + Receipt Overview */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">

                {/* GRN Header Panel */}
                <div className="xl:col-span-8 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between bg-gradient-to-r from-[#0b0c36] to-[#121656] border-b border-orange-500/40 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-orange-500/20 rounded-lg flex items-center justify-center border border-orange-500/30">
                        <FileText className="w-4 h-4 text-orange-400" />
                      </div>
                      <p className="text-sm font-black text-white tracking-wide">GRN Header</p>
                    </div>
                    <span className="text-[10px] font-extrabold bg-orange-500/20 text-orange-300 border border-orange-500/30 px-2.5 py-0.5 rounded-full font-mono">CORE DETAILS</span>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="supplier" className="text-xs font-bold text-slate-700 uppercase tracking-wide">Supplier *</Label>
                        <Select value={supplierId} onValueChange={setSupplierId}>
                          <SelectTrigger className="bg-slate-50 border-slate-200 font-medium focus:border-orange-500 focus:ring-orange-500/20">
                            <SelectValue placeholder="Select supplier..." />
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
                        <Label htmlFor="received_date" className="text-xs font-bold text-slate-700 uppercase tracking-wide">Received Date *</Label>
                        <Input
                          id="received_date"
                          type="date"
                          value={receivedDate}
                          onChange={(e) => setReceivedDate(e.target.value)}
                          className="bg-slate-50 border-slate-200 font-medium focus:border-orange-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Receipt Overview Panel */}
                <div className="xl:col-span-4 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between bg-gradient-to-r from-[#0b0c36] to-[#121656] border-b border-orange-500/40 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-orange-500/20 rounded-lg flex items-center justify-center border border-orange-500/30">
                        <Hash className="w-4 h-4 text-orange-400" />
                      </div>
                      <p className="text-sm font-black text-white tracking-wide">Receipt Overview</p>
                    </div>
                    <span className="text-[10px] font-extrabold bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2.5 py-0.5 rounded-full font-mono">AUTO</span>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Ordered</p>
                        <p className="font-extrabold text-slate-800 text-base mt-0.5 font-mono">{totalOrderedQty.toLocaleString()} <span className="text-xs font-medium text-slate-400">kg</span></p>
                      </div>
                      <div className="rounded-xl border border-orange-200 bg-orange-50/50 px-3 py-2.5">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-orange-600">Received</p>
                        <p className="font-extrabold text-orange-900 text-base mt-0.5 font-mono">{totalReceivedQty.toLocaleString()} <span className="text-xs font-medium text-orange-600">kg</span></p>
                      </div>
                      <div className="col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Weigh Bridge Nett</p>
                        <p className="font-extrabold text-slate-800 text-base mt-0.5 font-mono">{wbNettMassValue ? wbNettMassValue.toLocaleString() : 0} <span className="text-xs font-medium text-slate-400">kg</span></p>
                      </div>
                    </div>

                    <div className={`rounded-xl px-3 py-2.5 text-xs font-medium flex items-center gap-2 ${wbNettMassValue > 0 && wbVariancePct > 2 ? 'bg-amber-50 border border-amber-200 text-amber-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${wbNettMassValue > 0 && wbVariancePct > 2 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                      {wbNettMassValue > 0
                        ? `Variance: ${wbVariancePct.toFixed(1)}% — GRN vs WB nett mass`
                        : 'Variance will appear once nett mass is entered'}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="notes" className="text-xs font-bold text-slate-700 uppercase tracking-wide">Notes</Label>
                      <Textarea
                        id="notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Additional notes or comments..."
                        rows={3}
                        className="bg-slate-50 border-slate-200 text-sm resize-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Weigh Bridge Ticket Section */}
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => setWbExpanded(!wbExpanded)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#0b0c36] to-[#121656] border-b border-orange-500/40 text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 bg-orange-500/20 rounded-lg flex items-center justify-center border border-orange-500/30">
                      <Scale className="w-4 h-4 text-orange-400" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-white">Weigh Bridge Ticket</p>
                      <p className="text-[10px] text-slate-300 font-medium">Optional — Link or capture inbound logistics data</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full font-mono">INBOUND LOGISTICS</span>
                    {wbExpanded ? <ChevronUp className="w-4 h-4 text-white" /> : <ChevronDown className="w-4 h-4 text-white" />}
                  </div>
                </button>

                {wbExpanded && (
                  <div className="p-4 space-y-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                      <Label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Link Existing Ticket</Label>
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
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      {/* Vehicle & Driver */}
                      <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
                        <div className="bg-slate-100 border-b border-slate-200 px-3 py-2">
                          <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">🚛 Vehicle & Driver</p>
                        </div>
                        <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-500">Ticket No</Label>
                            <Input value={wbForm.transaction_no} onChange={(e) => setWbForm({ ...wbForm, transaction_no: e.target.value })} placeholder="WB-001" className="bg-white" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-500">Vehicle Reg</Label>
                            <Input value={wbForm.vehicle_reg} onChange={(e) => setWbForm({ ...wbForm, vehicle_reg: e.target.value })} placeholder="ABC-1234" className="bg-white" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-500">Haulier</Label>
                            <Input value={wbForm.haulier_code} onChange={(e) => setWbForm({ ...wbForm, haulier_code: e.target.value })} className="bg-white" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-500">Trailer No</Label>
                            <Input value={wbForm.trailer_number} onChange={(e) => setWbForm({ ...wbForm, trailer_number: e.target.value })} className="bg-white" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-500">Driver Name</Label>
                            <Input value={wbForm.driver_name} onChange={(e) => setWbForm({ ...wbForm, driver_name: e.target.value })} className="bg-white" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-500">Driver ID</Label>
                            <Input value={wbForm.driver_id} onChange={(e) => setWbForm({ ...wbForm, driver_id: e.target.value })} className="bg-white" />
                          </div>
                        </div>
                      </div>

                      {/* Weighing Data */}
                      <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
                        <div className="bg-slate-100 border-b border-slate-200 px-3 py-2">
                          <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">⚖️ Weighing Data</p>
                        </div>
                        <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-500">Product Code</Label>
                            <Input value={wbForm.product_code} onChange={(e) => setWbForm({ ...wbForm, product_code: e.target.value })} className="bg-white" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-500">Comment</Label>
                            <Input value={wbForm.comment} onChange={(e) => setWbForm({ ...wbForm, comment: e.target.value })} placeholder="Optional..." className="bg-white" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-500">Time In</Label>
                            <Input type="datetime-local" value={wbForm.time_in} onChange={(e) => setWbForm({ ...wbForm, time_in: e.target.value })} className="bg-white" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-500">Time Out</Label>
                            <Input type="datetime-local" value={wbForm.time_out} onChange={(e) => setWbForm({ ...wbForm, time_out: e.target.value })} className="bg-white" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-500">First Mass (kg)</Label>
                            <Input type="number" value={wbForm.first_mass} onChange={(e) => setWbForm({ ...wbForm, first_mass: e.target.value })} className="bg-white" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-500">Second Mass (kg)</Label>
                            <Input type="number" value={wbForm.second_mass} onChange={(e) => setWbForm({ ...wbForm, second_mass: e.target.value })} className="bg-white" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-500">Nett Mass (kg)</Label>
                            <Input type="number" value={wbForm.nett_mass} onChange={(e) => setWbForm({ ...wbForm, nett_mass: e.target.value })} className="bg-white font-bold" />
                          </div>
                          <div className="flex items-end">
                            <div className="flex items-center gap-2 h-10 px-3 rounded-lg border border-slate-200 bg-white w-full cursor-pointer">
                              <input
                                type="checkbox"
                                id="wb_driver_signed"
                                checked={wbForm.driver_signed}
                                onChange={(e) => setWbForm({ ...wbForm, driver_signed: e.target.checked })}
                                className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                              />
                              <Label htmlFor="wb_driver_signed" className="text-xs font-semibold cursor-pointer">Driver Signed</Label>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Line Items Section */}
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="flex items-center justify-between bg-gradient-to-r from-[#0b0c36] to-[#121656] border-b border-orange-500/40 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 bg-orange-500/20 rounded-lg flex items-center justify-center border border-orange-500/30">
                      <Warehouse className="w-4 h-4 text-orange-400" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-white">Line Items</p>
                      <p className="text-[10px] text-slate-300 font-medium">{items.length} item{items.length !== 1 ? 's' : ''} · Raw material receipts</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={addItem}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/40 text-orange-300 text-xs font-black rounded-xl transition-all shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Item
                  </button>
                </div>

                <div className="p-4 space-y-3">
                  {items.map((item, index) => (
                    <div key={index} className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
                      {/* Item header */}
                      <div className="flex items-center justify-between bg-white border-b border-slate-100 px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 bg-[#0b0c36] text-orange-400 text-[10px] font-black rounded-full flex items-center justify-center border border-orange-500/30">{index + 1}</span>
                          <span className="text-xs font-bold text-slate-800">Raw Material Line {index + 1}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex gap-2 text-xs">
                            <span className="bg-slate-100 border border-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono font-bold">{Number(item.received_qty || 0).toLocaleString()} kg</span>
                            <span className="bg-orange-50 border border-orange-200 text-orange-700 px-2 py-0.5 rounded font-mono font-bold">${((Number(item.received_qty) || 0) * (Number(item.unit_cost) || 0)).toFixed(4)}</span>
                          </div>
                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeItem(index)}
                              className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1 rounded-lg transition-colors border border-rose-200"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Material selector */}
                      <div className="px-4 pt-3 pb-2">
                        <Label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Raw Material *</Label>
                        <Select
                          value={item.raw_material_id}
                          onValueChange={(value) => updateItem(index, 'raw_material_id', value)}
                        >
                          <SelectTrigger className="mt-1.5 bg-white border-slate-200 font-medium focus:border-orange-500">
                            <SelectValue placeholder="Select material" />
                          </SelectTrigger>
                          <SelectContent>
                            {materials.map((material) => (
                              <SelectItem key={material.id} value={material.id}>
                                {material.code} — {material.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Quantity grid */}
                      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 px-4 pb-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-slate-500">Ordered Qty</Label>
                          <Input
                            type="number"
                            value={item.ordered_qty}
                            onChange={(e) => updateItem(index, 'ordered_qty', parseLineItemNumber(e.target.value))}
                            step="0.01"
                            className="bg-white border-slate-200"
                            placeholder="0.00"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-orange-600">Received Qty *</Label>
                          <Input
                            type="number"
                            value={item.received_qty}
                            onChange={(e) => updateItem(index, 'received_qty', parseLineItemNumber(e.target.value))}
                            step="0.01"
                            className="bg-white border-orange-300 focus:border-orange-500 font-extrabold text-slate-900"
                            placeholder="0.00"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-slate-500">Unit Cost ($)</Label>
                          <Input
                            type="number"
                            value={item.unit_cost}
                            onChange={(e) => updateItem(index, 'unit_cost', parseLineItemNumber(e.target.value))}
                            step="0.0001"
                            className="bg-white border-slate-200 font-medium"
                            placeholder="0.0000"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-slate-500">Batch Number</Label>
                          <Input
                            value={item.batch_number}
                            onChange={(e) => updateItem(index, 'batch_number', e.target.value)}
                            className="bg-white border-slate-200 font-mono"
                            placeholder="e.g. BTH-001"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-slate-500">Expiry Date</Label>
                          <Input
                            type="date"
                            value={item.expiry_date}
                            onChange={(e) => updateItem(index, 'expiry_date', e.target.value)}
                            className="bg-white border-slate-200"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Summary Bar */}
                  <div className="rounded-2xl border border-orange-500/30 bg-gradient-to-r from-[#06061c] via-[#0b0c36] to-[#080829] px-4 py-3.5 shadow-lg">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div className="text-center">
                        <p className="text-slate-400 uppercase tracking-wider text-[10px] font-bold">Total Ordered</p>
                        <p className="font-black text-white text-base font-mono mt-0.5">{totalOrderedQty.toLocaleString()} <span className="text-slate-400 text-xs font-medium">kg</span></p>
                      </div>
                      <div className="text-center border-x border-slate-800">
                        <p className="text-orange-400 uppercase tracking-wider text-[10px] font-bold">Total Received</p>
                        <p className="font-black text-orange-400 text-base font-mono mt-0.5">{totalReceivedQty.toLocaleString()} <span className="text-orange-300 text-xs font-medium">kg</span></p>
                      </div>
                      <div className="text-center">
                        <p className="text-amber-400 uppercase tracking-wider text-[10px] font-bold">Estimated Value</p>
                        <p className="font-black text-amber-300 text-base font-mono mt-0.5">${totalReceivedValue.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="shrink-0 flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-6 py-4 rounded-b-2xl">
            <p className="text-xs text-slate-500 font-medium hidden sm:block">GRN will be posted to Sage 200 Evolution automatically upon approval</p>
            <div className="flex gap-3 ml-auto">
              <button
                onClick={() => setModalOpen(false)}
                disabled={saving}
                className="px-5 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveGRN}
                disabled={saving}
                className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-black text-white bg-gradient-to-r from-orange-500 via-amber-600 to-orange-600 hover:from-orange-600 hover:to-amber-700 rounded-xl shadow-lg shadow-orange-500/25 transition-all disabled:opacity-50 hover:scale-[1.01]"
              >
                {saving ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating...</>
                ) : (
                  <><Package className="w-4 h-4" /> Create GRN</>
                )}
              </button>
            </div>
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
                <div className="border-l-3 border-l-purple-500 bg-white rounded-lg border border-slate-200 p-2.5">
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Initiated By</p>
                  <p className="text-xs font-semibold text-slate-800 mt-0.5">{(viewing as any)?.receiver?.full_name || (viewing as any)?.receiver?.email || 'System'}</p>
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
                          <TableCell className="text-xs text-right text-slate-600 py-2 px-3">${Number(item.unit_cost || 0).toFixed(4)}</TableCell>
                          <TableCell className="text-xs text-right font-bold text-emerald-700 py-2 px-3">${(item.received_qty * item.unit_cost).toFixed(4)}</TableCell>
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
