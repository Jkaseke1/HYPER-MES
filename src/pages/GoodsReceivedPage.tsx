import { useState, useEffect } from 'react';
import { Plus, Search, Eye, Package, Calendar, Clock, FileText } from 'lucide-react';
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

  async function fetchData() {
    setLoading(true);
    const [grnsRes, suppliersRes, materialsRes, wbRes] = await Promise.all([
      supabase.from('goods_received_notes').select('*, suppliers(name), warehouses(name)').order('created_at', { ascending: false }),
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

      const { data: grn, error: grnError } = await supabase
        .from('goods_received_notes')
        .insert(grnData)
        .select()
        .single();

      if (grnError) throw grnError;

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
                <TableHead>Received Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created By</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredGRNs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No GRNs found
                  </TableCell>
                </TableRow>
              ) : (
                filteredGRNs.map((grn) => (
                  <TableRow key={grn.id}>
                    <TableCell className="font-medium">{grn.grn_number}</TableCell>
                    <TableCell>{grn.suppliers?.name}</TableCell>
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
        <DialogContent className="max-w-3xl flex flex-col max-h-[90vh]">
          <DialogHeader className="shrink-0">
            <DialogTitle>Create New GRN</DialogTitle>
            <DialogDescription>Add a new goods received note for incoming materials</DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 pr-1">
          <div className="space-y-4 py-2">
            {/* Header Section */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="supplier">Supplier *</Label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger>
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

              <div className="space-y-2">
                <Label htmlFor="received_date">Received Date *</Label>
                <Input
                  id="received_date"
                  type="date"
                  value={receivedDate}
                  onChange={(e) => setReceivedDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="weigh_bridge">Weigh Bridge Ticket</Label>
              <div className="flex items-center gap-2">
                <Select value={weighBridgeTicketId} onValueChange={setWeighBridgeTicketId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select weigh bridge ticket (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {wbTickets.map((ticket) => (
                      <SelectItem key={ticket.id} value={ticket.id}>
                        {ticket.ticket_no} - {ticket.vehicle_reg || 'N/A'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {weighBridgeTicketId && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setWeighBridgeTicketId('')}
                    className="text-slate-500 hover:text-red-600 shrink-0"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes or comments..."
                rows={3}
              />
            </div>

            {/* Items Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base">Line Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </Button>
              </div>

              {items.map((item, index) => (
                <Card key={index}>
                  <CardContent className="pt-4">
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label>Raw Material *</Label>
                        <Select
                          value={item.raw_material_id}
                          onValueChange={(value) => updateItem(index, 'raw_material_id', value)}
                        >
                          <SelectTrigger>
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

                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Ordered Qty</Label>
                          <Input
                            type="number"
                            value={item.ordered_qty}
                            onChange={(e) => updateItem(index, 'ordered_qty', Number(e.target.value))}
                            step="0.01"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Received Qty *</Label>
                          <Input
                            type="number"
                            value={item.received_qty}
                            onChange={(e) => updateItem(index, 'received_qty', Number(e.target.value))}
                            step="0.01"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Unit Cost</Label>
                          <Input
                            type="number"
                            value={item.unit_cost}
                            onChange={(e) => updateItem(index, 'unit_cost', Number(e.target.value))}
                            step="0.01"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Batch Number</Label>
                          <Input
                            value={item.batch_number}
                            onChange={(e) => updateItem(index, 'batch_number', e.target.value)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Expiry Date</Label>
                          <Input
                            type="date"
                            value={item.expiry_date}
                            onChange={(e) => updateItem(index, 'expiry_date', e.target.value)}
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
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

          </div>
          </div>

          <div className="shrink-0 flex justify-end space-x-2 pt-4 border-t">
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
        <DialogContent className="max-w-[1400px] w-[98vw] max-h-[90vh] overflow-y-auto p-6 sm:!max-w-[1400px]">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>{viewing?.grn_number}</DialogTitle>
                <DialogDescription className="mt-1">
                  {viewing && format(new Date(viewing.received_date), 'PPP')}
                </DialogDescription>
              </div>
              {viewing && getStatusBadge(viewing.status)}
            </div>
          </DialogHeader>

          <div className="space-y-5">
            {/* Header Info */}
            <div className="grid grid-cols-3 gap-4 bg-slate-50 rounded-lg p-4">
              <div>
                <p className="text-xs text-slate-500">Supplier</p>
                <p className="text-sm font-medium text-slate-800">{viewing?.suppliers?.name || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Warehouse</p>
                <p className="text-sm font-medium text-slate-800">{viewing?.warehouses?.name || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Created</p>
                <p className="text-sm font-medium text-slate-800">{viewing && format(new Date(viewing.created_at), 'PPP')}</p>
              </div>
            </div>

            {viewing?.notes && (
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                <Label className="text-xs text-slate-500">Notes</Label>
                <p className="text-sm text-slate-700 mt-1">{viewing.notes}</p>
              </div>
            )}

            {/* Line Items Table */}
            <div>
              <Label className="text-base mb-3 block">Line Items</Label>
              <div className="border border-slate-200 rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="text-xs font-semibold text-slate-600 py-2 px-3">Material</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-600 text-right py-2 px-3 w-[100px]">Ordered</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-600 text-right py-2 px-3 w-[100px]">Received</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-600 text-right py-2 px-3 w-[100px]">Unit Cost</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-600 text-right py-2 px-3 w-[120px]">Line Total</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-600 py-2 px-3 w-[130px]">Batch</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-600 py-2 px-3 w-[120px]">Expiry</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewItems.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="text-sm font-medium text-slate-700 py-2 px-3">
                          {item.raw_materials?.code} - {item.raw_materials?.name}
                        </TableCell>
                        <TableCell className="text-sm text-right text-slate-600 py-2 px-3">{item.ordered_qty.toLocaleString()} kg</TableCell>
                        <TableCell className="text-sm text-right text-slate-600 py-2 px-3">{item.received_qty.toLocaleString()} kg</TableCell>
                        <TableCell className="text-sm text-right text-slate-600 py-2 px-3">${item.unit_cost.toFixed(2)}</TableCell>
                        <TableCell className="text-sm text-right font-medium text-slate-700 py-2 px-3">${(item.received_qty * item.unit_cost).toFixed(2)}</TableCell>
                        <TableCell className="text-sm text-slate-600 font-mono text-xs py-2 px-3">{item.batch_number || '-'}</TableCell>
                        <TableCell className="text-sm text-slate-600 py-2 px-3">{item.expiry_date ? format(new Date(item.expiry_date), 'PP') : '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Totals */}
              <div className="flex justify-end gap-8 mt-3 text-sm">
                <span className="text-slate-600">
                  Total Ordered: <strong className="text-slate-800">{viewItems.reduce((s, i) => s + (i.ordered_qty || 0), 0).toLocaleString()} kg</strong>
                </span>
                <span className="text-slate-600">
                  Total Received: <strong className="text-slate-800">{viewItems.reduce((s, i) => s + (i.received_qty || 0), 0).toLocaleString()} kg</strong>
                </span>
                <span className="text-slate-600">
                  Total Value: <strong className="text-slate-800">${viewItems.reduce((s, i) => s + (i.received_qty || 0) * (i.unit_cost || 0), 0).toFixed(2)}</strong>
                </span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
