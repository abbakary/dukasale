'use client';

import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuid } from 'uuid';
import {
  Plus,
  Search,
  PackageCheck,
  FileText,
  MoreHorizontal,
  Boxes,
  Truck,
  Clock3,
  CircleDollarSign,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/stores/auth-store';
import { db } from '@/lib/db/dexie';
import type { PurchaseOrder, PurchaseItem, Supplier } from '@/lib/types';
import { createTenantResource, deleteTenantResource, receivePurchaseOrderItems, updateTenantResource } from '@/lib/api/tenant';
import { syncTenantDataFromApi } from '@/lib/services/sync-from-api';
import { transformPurchaseOrderToDeliveryNote, transformPurchaseOrderToInvoice, transformPurchaseOrderToOrderSlip, transformPurchaseOrderToPaymentSlip, transformPurchaseOrderToQuotation } from '@/lib/utils/document-transform';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { DocumentPreviewDialog } from '@/components/shared/documents/document-preview-dialog';
import { useI18n } from '@/lib/i18n/use-i18n';

type NewPoLine = {
  id: string;
  productId?: string;
  categoryId?: string;
  productName: string;
  sku: string;
  unit: string;
  orderedQuantity: number;
  unitCost: number;
  sellingPrice: number;
  taxRate: number;
  taxType: 'percentage' | 'fixed';
  minStock: number;
};

const purchaseUnitOptions = [
  'piece',
  'box',
  'pack',
  'dozen',
  'strip',
  'bottle',
  'vial',
  'ampoule',
  'tube',
  'sachet',
  'tin',
  'kg',
  'g',
  'liter',
  'ml',
  'meter',
  'cm',
] as const;

function genSKU(name: string) {
  const prefix = name.trim().substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '') || 'PRD';
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `${prefix}-${rand}`;
}

export default function PurchasesPage() {
  const { company, token, user } = useAuthStore();
  const currency = company?.currencySymbol || 'TSH';
  const { t } = useI18n();
  const canManage = user?.role === 'admin' || user?.role === 'super_admin';

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | PurchaseOrder['status']>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [saving, setSaving] = useState(false);
  const [receiving, setReceiving] = useState(false);
  const [autoCreateInventory, setAutoCreateInventory] = useState(true);
  const [receiveMap, setReceiveMap] = useState<Record<string, number>>({});
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);

  const [form, setForm] = useState({
    supplierId: '',
    expectedDate: '',
    amountPaid: 0,
    shippingCost: 0,
    otherCosts: 0,
    discountAmount: 0,
    taxAmount: 0,
    notes: '',
  });
  const [lines, setLines] = useState<NewPoLine[]>([
    {
      id: uuid(),
      productName: '',
      sku: genSKU(''),
      unit: 'piece',
      orderedQuantity: 1,
      unitCost: 0,
      sellingPrice: 0,
      taxRate: 0,
      taxType: 'percentage',
      minStock: 0,
    },
  ]);

  const purchaseOrders = useLiveQuery(async () => {
    if (!company?.id) return [];
    return db.purchaseOrders.where('companyId').equals(company.id).reverse().toArray();
  }, [company?.id], []);

  const suppliers = useLiveQuery(async () => {
    if (!company?.id) return [];
    return db.suppliers.where('companyId').equals(company.id).filter((s) => s.isActive).toArray();
  }, [company?.id], []);

  const products = useLiveQuery(async () => {
    if (!company?.id) return [];
    return db.products.where('companyId').equals(company.id).filter((p) => p.isActive).toArray();
  }, [company?.id], []);

  const categories = useLiveQuery(async () => {
    if (!company?.id) return [];
    return db.categories.where('companyId').equals(company.id).filter((c) => c.isActive).toArray();
  }, [company?.id], []);

  const supplierMap = useMemo(() => {
    const map = new Map<string, Supplier>();
    (suppliers || []).forEach((s) => map.set(s.id, s));
    return map;
  }, [suppliers]);

  const stats = useMemo(() => {
    const orders = purchaseOrders || [];
    return {
      totalOrders: orders.length,
      pendingReceive: orders.filter((o) => o.status === 'ordered' || o.status === 'partial').length,
      receivedOrders: orders.filter((o) => o.status === 'received').length,
      totalValue: orders.reduce((sum, o) => sum + Number(o.total || 0), 0),
    };
  }, [purchaseOrders]);

  const totalReceivingNow = useMemo(() => {
    if (!selectedOrder) return 0;
    return Object.values(receiveMap).reduce((sum, qty) => sum + Number(qty || 0), 0);
  }, [selectedOrder, receiveMap]);

  const filteredOrders = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (purchaseOrders || []).filter((o) => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (!q) return true;
      return (
        o.orderNumber.toLowerCase().includes(q) ||
        o.supplierName.toLowerCase().includes(q) ||
        o.items.some((i) => i.productName.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q))
      );
    });
  }, [purchaseOrders, query, statusFilter]);

  const resetCreateForm = () => {
    setForm({
      supplierId: '',
      expectedDate: '',
      amountPaid: 0,
      shippingCost: 0,
      otherCosts: 0,
      discountAmount: 0,
      taxAmount: 0,
      notes: '',
    });
    setLines([
      {
        id: uuid(),
        productName: '',
        sku: genSKU(''),
        unit: 'piece',
        orderedQuantity: 1,
        unitCost: 0,
        sellingPrice: 0,
        taxRate: 0,
        taxType: 'percentage',
        minStock: 0,
      },
    ]);
  };

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      { id: uuid(), productName: '', sku: genSKU(''), unit: 'piece', orderedQuantity: 1, unitCost: 0, sellingPrice: 0, taxRate: 0, taxType: 'percentage', minStock: 0 },
    ]);
  };

  const removeLine = (id: string) => {
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.id !== id) : prev));
  };

  const updateLine = (id: string, patch: Partial<NewPoLine>) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const applyProductToLine = (lineId: string, productId: string) => {
    const product = (products || []).find((p) => p.id === productId);
    if (!product) return;
    updateLine(lineId, {
      productId: product.id,
      productName: product.name,
      sku: product.sku || '',
      unit: product.unit || 'piece',
      unitCost: Number(product.costPrice || 0),
      sellingPrice: Number(product.sellingPrice || 0),
      taxRate: Number(product.taxRate || 0),
      taxType: (product as any).taxType || 'percentage',
      minStock: Number(product.minStock || 0),
      categoryId: product.categoryId || undefined,
    });
  };

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      toast.error(t('purchases.enterCategoryName'));
      return;
    }
    if (!token) {
      toast.error(t('purchases.sessionExpired'));
      return;
    }

    setCreatingCategory(true);
    try {
      const created = await createTenantResource<{ id: string }>(
        'categories',
        {
          id: uuid(),
          name,
          sort_order: 0,
          is_active: true,
        },
        token
      );
      await syncTenantDataFromApi(token);
      setNewCategoryName('');
      setLines((prev) =>
        prev.map((line) => (line.categoryId ? line : { ...line, categoryId: created.id }))
      );
      toast.success(`${t('purchases.categoryCreated')}: "${name}"`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('purchases.failedCreateCategory'));
    } finally {
      setCreatingCategory(false);
    }
  };

  const subtotal = useMemo(
    () =>
      lines.reduce((sum, l) => {
        const qty = Number(l.orderedQuantity || 0);
        const cost = Number(l.unitCost || 0);
        return sum + qty * cost;
      }, 0),
    [lines]
  );

  const totalTax = useMemo(
    () =>
      lines.reduce((sum, l) => {
        const qty = Number(l.orderedQuantity || 0);
        const cost = Number(l.unitCost || 0);
        const tr = Number(l.taxRate || 0);
        if (l.taxType === 'percentage') {
           return sum + qty * cost * (tr / 100);
         } else {
           // Fixed tax amount per single item
           return sum + tr * qty;
         }
      }, 0),
    [lines]
  );

  const total = Math.max(
    0,
    subtotal + totalTax + Number(form.shippingCost || 0) + Number(form.otherCosts || 0) - Number(form.discountAmount || 0)
  );
  const amountDue = Math.max(0, total - Number(form.amountPaid || 0));

  const openReceiveDialog = (order: PurchaseOrder) => {
    const initialMap: Record<string, number> = {};
    order.items.forEach((item) => {
      const remaining = Math.max(0, Number(item.orderedQuantity || 0) - Number(item.receivedQuantity || 0));
      initialMap[item.id] = remaining;
    });
    setSelectedOrder(order);
    setReceiveMap(initialMap);
    setAutoCreateInventory(true);
    setReceiveOpen(true);
  };

  const setReceiveToAllRemaining = () => {
    if (!selectedOrder) return;
    const next: Record<string, number> = {};
    selectedOrder.items.forEach((item) => {
      const remaining = Math.max(0, Number(item.orderedQuantity || 0) - Number(item.receivedQuantity || 0));
      next[item.id] = remaining;
    });
    setReceiveMap(next);
  };

  const clearReceiveQtys = () => {
    if (!selectedOrder) return;
    const next: Record<string, number> = {};
    selectedOrder.items.forEach((item) => {
      next[item.id] = 0;
    });
    setReceiveMap(next);
  };

  const handleCreateOrder = async () => {
    if (!token) {
      toast.error(t('purchases.sessionExpired'));
      return;
    }
    const supplier = (suppliers || []).find((s) => s.id === form.supplierId);
    if (!supplier) {
      toast.error(t('purchases.selectSupplierRequired'));
      return;
    }

    const sanitizedLines = lines
      .map((l) => ({
        ...l,
        orderedQuantity: Number(l.orderedQuantity || 0),
        unitCost: Number(l.unitCost || 0),
        sellingPrice: Number(l.sellingPrice || 0),
        taxRate: Number(l.taxRate || 0),
        minStock: Number(l.minStock || 0),
      }))
      .filter((l) => l.productName.trim() && l.orderedQuantity > 0);

    if (sanitizedLines.length === 0) {
      toast.error(t('purchases.addValidLineItem'));
      return;
    }

    const invalidSkuLine = sanitizedLines.find((l) => !l.sku.trim());
    if (invalidSkuLine) {
      toast.error(t('purchases.skuRequired'));
      return;
    }

    const invalidManualLine = sanitizedLines.find((l) => !l.productId && (!l.categoryId || Number(l.sellingPrice || 0) <= 0));
    if (invalidManualLine) {
      toast.error(t('purchases.manualNeedsCategorySelling'));
      return;
    }

    setSaving(true);
    try {
      const allOrders = purchaseOrders || [];
      const nextNumber = String(allOrders.length + 1).padStart(5, '0');
      const orderNumber = `PO-${nextNumber}`;

      const items = sanitizedLines.map((l) => ({
        id: l.id,
        productId: l.productId || '',
        categoryId: l.categoryId || null,
        productName: l.productName.trim(),
        sku: l.sku.trim(),
        orderedQuantity: Number(l.orderedQuantity),
        receivedQuantity: 0,
        unit: (l.unit || 'piece') as PurchaseItem['unit'],
        unitCost: Number(l.unitCost),
        sellingPrice: Number(l.sellingPrice || l.unitCost || 0),
        taxRate: Number(l.taxRate || 0),
        taxAmount: Number(l.orderedQuantity) * Number(l.unitCost) * (Number(l.taxRate || 0) / 100),
        minStock: Number(l.minStock || 0),
        total: Number(l.orderedQuantity) * Number(l.unitCost),
      }));

      await createTenantResource(
        'purchase_orders',
        {
          id: uuid(),
          order_number: orderNumber,
          supplier_id: supplier.id,
          supplier_name: supplier.name,
          status: 'ordered',
          items,
          subtotal,
          discount_amount: Number(form.discountAmount || 0),
          tax_amount: totalTax,
          shipping_cost: Number(form.shippingCost || 0),
          other_costs: Number(form.otherCosts || 0),
          total,
          amount_paid: Number(form.amountPaid || 0),
          amount_due: amountDue,
          expected_date: form.expectedDate ? new Date(form.expectedDate).toISOString() : undefined,
          notes: form.notes?.trim() || undefined,
        },
        token
      );

      await syncTenantDataFromApi(token);
      toast.success(`${t('purchases.orderCreated')}: ${orderNumber}`);
      setCreateOpen(false);
      resetCreateForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('purchases.failedCreateOrder'));
    } finally {
      setSaving(false);
    }
  };

  const handleReceiveItems = async () => {
    if (!token || !selectedOrder) {
      toast.error(t('purchases.invalidOrderSession'));
      return;
    }
    
    if (totalReceivingNow <= 0) {
      toast.error(t('purchases.enterReceivingQty'));
      return;
    }

    setReceiving(true);
    try {
      await receivePurchaseOrderItems(selectedOrder.id, receiveMap, token, autoCreateInventory);
      await syncTenantDataFromApi(token);
      toast.success(`${t('purchases.receiptPosted')} ${selectedOrder.orderNumber}`);
      setReceiveOpen(false);
      setSelectedOrder(null);
      setReceiveMap({});
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('purchases.failedReceiveItems'));
    } finally {
      setReceiving(false);
    }
  };

  const handleCancelOrder = async (order: PurchaseOrder) => {
    if (!token || !canManage) {
      toast.error('Only admin users can cancel purchase orders');
      return;
    }
    if (order.status === 'received') {
      toast.error('Received orders cannot be cancelled');
      return;
    }
    const confirmed = window.confirm(`Cancel order ${order.orderNumber}?`);
    if (!confirmed) return;
    try {
      await updateTenantResource('purchase_orders', order.id, { status: 'cancelled' }, token);
      await syncTenantDataFromApi(token);
      toast.success(`Order ${order.orderNumber} cancelled`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to cancel order');
    }
  };

  const handleDeleteOrder = async (order: PurchaseOrder) => {
    if (!token || !canManage) {
      toast.error('Only admin users can delete purchase orders');
      return;
    }
    const confirmed = window.confirm(`Delete order ${order.orderNumber}? This cannot be undone.`);
    if (!confirmed) return;
    try {
      await deleteTenantResource('purchase_orders', order.id, token);
      await syncTenantDataFromApi(token);
      toast.success(`Order ${order.orderNumber} deleted`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete order');
    }
  };

  const badgeForStatus = (status: PurchaseOrder['status']) => {
    if (status === 'received') return <Badge className="bg-green-100 text-green-800">{t('purchases.received')}</Badge>;
    if (status === 'partial') return <Badge className="bg-amber-100 text-amber-800">{t('purchases.partial')}</Badge>;
    if (status === 'ordered') return <Badge className="bg-blue-100 text-blue-800">{t('purchases.ordered')}</Badge>;
    if (status === 'draft') return <Badge variant="outline">{t('purchases.draft')}</Badge>;
    return <Badge className="bg-red-100 text-red-800">{t('purchases.cancelled')}</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('purchases.title')}</h1>
          <p className="text-muted-foreground">{t('purchases.subtitle')}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} disabled={!canManage}>
          <Plus className="mr-2 size-4" />
          {t('purchases.newPurchaseOrder')}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Truck className="size-8 text-primary" />
              <div>
                <div className="text-2xl font-bold">{stats.totalOrders}</div>
                <p className="text-sm text-muted-foreground">{t('purchases.totalOrders')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock3 className="size-8 text-amber-600" />
              <div>
                <div className="text-2xl font-bold">{stats.pendingReceive}</div>
                <p className="text-sm text-muted-foreground">{t('purchases.pendingReceive')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <PackageCheck className="size-8 text-green-600" />
              <div>
                <div className="text-2xl font-bold">{stats.receivedOrders}</div>
                <p className="text-sm text-muted-foreground">{t('purchases.receivedOrders')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CircleDollarSign className="size-8 text-violet-600" />
              <div>
                <div className="text-2xl font-bold">
                  {currency}
                  {stats.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
                <p className="text-sm text-muted-foreground">{t('purchases.orderValue')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('purchases.allPurchaseOrders')}</CardTitle>
          <CardDescription>{filteredOrders.length} orders shown</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder={t('purchases.searchOrders')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('purchases.allStatus')}</SelectItem>
                <SelectItem value="ordered">{t('purchases.ordered')}</SelectItem>
                <SelectItem value="partial">{t('purchases.partial')}</SelectItem>
                <SelectItem value="received">{t('purchases.received')}</SelectItem>
                <SelectItem value="draft">{t('purchases.draft')}</SelectItem>
                <SelectItem value="cancelled">{t('purchases.cancelled')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('purchases.orderNo')}</TableHead>
                <TableHead>{t('purchases.supplier')}</TableHead>
                <TableHead>{t('purchases.status')}</TableHead>
                <TableHead className="text-right">{t('purchases.items')}</TableHead>
                <TableHead className="text-right">{t('purchases.total')}</TableHead>
                <TableHead>{t('purchases.expected')}</TableHead>
                <TableHead className="text-right">{t('purchases.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {t('purchases.noPurchaseOrdersFound')}
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => {
                  const supplier = supplierMap.get(order.supplierId);
                  const docsData = company
                    ? {
                        invoice: transformPurchaseOrderToInvoice(order, company, supplier),
                        quotation: transformPurchaseOrderToQuotation(order, company, supplier),
                        deliveryNote: transformPurchaseOrderToDeliveryNote(order, company, supplier),
                        paymentSlip: transformPurchaseOrderToPaymentSlip(order, company, supplier),
                        orderSlip: transformPurchaseOrderToOrderSlip(order, company, supplier),
                      }
                    : null;
                  const canReceive = order.status === 'ordered' || order.status === 'partial';

                  return (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono">{order.orderNumber}</TableCell>
                      <TableCell className="font-medium">{order.supplierName}</TableCell>
                      <TableCell>{badgeForStatus(order.status)}</TableCell>
                      <TableCell className="text-right">{order.items.length}</TableCell>
                      <TableCell className="text-right font-medium">
                        {currency}
                        {Number(order.total || 0).toFixed(2)}
                      </TableCell>
                      <TableCell>{order.expectedDate ? new Date(order.expectedDate).toLocaleDateString() : '—'}</TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!canReceive || !canManage}
                            onClick={() => openReceiveDialog(order)}
                          >
                            <Boxes className="mr-1 size-4" />
                            {t('purchases.receive')}
                          </Button>
                          {docsData ? (
                            <DocumentPreviewDialog
                              data={docsData}
                              defaultType="invoice"
                              trigger={
                                <Button variant="outline" size="sm">
                                  <FileText className="mr-1 size-4" />
                                  {t('purchases.documents')}
                                </Button>
                              }
                            />
                          ) : (
                            <Button variant="outline" size="sm" disabled>
                              <FileText className="mr-1 size-4" />
                              {t('purchases.documents')}
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setQuery(order.orderNumber);
                                  toast.success(`${t('purchases.focusOrder')}: ${order.orderNumber}`);
                                }}
                              >
                                {t('purchases.focusOrder')}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  if (!canReceive) {
                                    toast.message(t('purchases.orderFullyReceived'));
                                    return;
                                  }
                                  openReceiveDialog(order);
                                }}
                              >
                                {t('purchases.quickReceive')}
                              </DropdownMenuItem>
                              {canManage && order.status !== 'received' && (
                                <DropdownMenuItem onClick={() => handleCancelOrder(order)}>
                                  {t('purchases.cancelled')}
                                </DropdownMenuItem>
                              )}
                              {canManage && (
                                <DropdownMenuItem
                                  onClick={() => handleDeleteOrder(order)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  Delete Order
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) resetCreateForm();
        }}
      >
        <DialogContent className="w-[98vw] h-[95vh] max-w-[1600px] sm:max-w-[1600px] p-0 flex flex-col gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-4 border-b">
            <DialogTitle>{t('purchases.createPurchaseOrder')}</DialogTitle>
            <DialogDescription>
              {t('purchases.startFromThisPage')}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>{t('purchases.supplier')} *</Label>
                <Select value={form.supplierId} onValueChange={(v) => setForm((f) => ({ ...f, supplierId: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('purchases.selectSupplier')} />
                  </SelectTrigger>
                  <SelectContent>
                    {(suppliers || []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('purchases.expectedDate')}</Label>
                <Input
                  type="date"
                  value={form.expectedDate}
                  onChange={(e) => setForm((f) => ({ ...f, expectedDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('purchases.amountPaid')}</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.amountPaid}
                  onChange={(e) => setForm((f) => ({ ...f, amountPaid: Number(e.target.value || 0) }))}
                />
              </div>
              <div className="rounded-md border p-3 space-y-1 bg-muted/20">
                <p className="text-xs text-muted-foreground">{t('purchases.currentTotal')}</p>
                <p className="text-lg font-bold">
                  {currency}
                  {total.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('purchases.due')}: {currency}
                  {amountDue.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="rounded-md border p-3">
              <div className="flex flex-col lg:flex-row lg:items-end gap-3">
                <div className="space-y-2 flex-1">
                  <Label>{t('purchases.quickCreateCategory')}</Label>
                  <Input
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="e.g. New Imported Items"
                  />
                </div>
                <Button variant="outline" onClick={handleCreateCategory} disabled={creatingCategory}>
                  {creatingCategory ? t('common.loading') : t('purchases.createCategory')}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">{t('purchases.orderItemsTable')}</h3>
                <Button variant="outline" onClick={addLine}>
                  <Plus className="mr-2 size-4" />
                  {t('purchases.addLine')}
                </Button>
              </div>
              <div className="rounded-md border overflow-x-auto">
                <Table className="w-full min-w-[1540px] table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">{t('purchases.productLink')}</TableHead>
                    <TableHead className="w-[240px]">{t('purchases.productName')}</TableHead>
                    <TableHead className="w-[170px]">{t('purchases.category')}</TableHead>
                    <TableHead className="w-[130px]">{t('purchases.skuCode')}</TableHead>
                    <TableHead className="w-[100px]">{t('purchases.unit')}</TableHead>
                    <TableHead className="w-[100px] text-right">{t('purchases.qty')}</TableHead>
                    <TableHead className="w-[120px] text-right">{t('purchases.unitCost')}</TableHead>
                    <TableHead className="w-[120px] text-right">Tax</TableHead>
                    <TableHead className="w-[140px] text-right">{t('purchases.selling')}</TableHead>
                    <TableHead className="w-[140px] text-right">{t('purchases.total')}</TableHead>
                    <TableHead className="w-[120px] text-right">{t('purchases.action')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line) => {
                    const lineTotal = Number(line.orderedQuantity || 0) * Number(line.unitCost || 0);
                    return (
                      <TableRow key={line.id}>
                        <TableCell>
                          <Select value={line.productId || '__manual__'} onValueChange={(v) => {
                            if (v === '__manual__') {
                              updateLine(line.id, { productId: undefined });
                              return;
                            }
                            applyProductToLine(line.id, v);
                          }}>
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder={t('purchases.pickExistingProduct')} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__manual__">{t('purchases.manualNotLinked')}</SelectItem>
                              {(products || []).map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            className="h-9"
                            value={line.productName}
                            onChange={(e) =>
                              updateLine(line.id, {
                                productName: e.target.value,
                                sku: line.productId ? line.sku : genSKU(e.target.value),
                              })
                            }
                            placeholder={t('purchases.productName')}
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={line.categoryId || '__none__'}
                            onValueChange={(v) => updateLine(line.id, { categoryId: v === '__none__' ? undefined : v })}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder={t('purchases.category')} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">{t('purchases.noCategory')}</SelectItem>
                              {(categories || []).map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            className="h-9"
                            value={line.sku}
                            onChange={(e) => updateLine(line.id, { sku: e.target.value.toUpperCase() })}
                            placeholder={t('purchases.skuCode')}
                          />
                        </TableCell>
                        <TableCell>
                          <Select value={line.unit} onValueChange={(v) => updateLine(line.id, { unit: v })}>
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {purchaseUnitOptions.map((unit) => (
                                <SelectItem key={unit} value={unit}>
                                  {unit}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            className="h-9 w-full min-w-0 max-w-[100px] text-right"
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.orderedQuantity}
                            onChange={(e) => updateLine(line.id, { orderedQuantity: Number(e.target.value || 0) })}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            className="h-9 w-full min-w-0 max-w-[120px] text-right"
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.unitCost}
                            onChange={(e) => updateLine(line.id, { unitCost: Number(e.target.value || 0) })}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              type="button"
                              onClick={() => updateLine(line.id, { taxType: line.taxType === 'fixed' ? 'percentage' : 'fixed' })}
                              className="text-[10px] font-bold text-primary hover:bg-primary/10 px-1 rounded h-8 min-w-[24px]"
                            >
                              {line.taxType === 'fixed' ? currency : '%'}
                            </button>
                            <Input
                              className="h-9 w-full min-w-0 max-w-[100px] text-right"
                              type="number"
                              min="0"
                              step="0.01"
                              value={line.taxRate}
                              onChange={(e) => updateLine(line.id, { taxRate: Number(e.target.value || 0) })}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            className="h-9 w-full min-w-0 max-w-[120px] text-right"
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.sellingPrice}
                            onChange={(e) => updateLine(line.id, { sellingPrice: Number(e.target.value || 0) })}
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium max-w-[140px] truncate">
                          {currency}
                          {lineTotal.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right w-[120px]">
                          <Button variant="ghost" size="sm" className="h-9 min-w-[90px]" onClick={() => removeLine(line.id)}>
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 rounded-md border border-dashed p-3">
              <div className="text-sm text-muted-foreground">
                For manual items, set category + selling price so auto-created inventory products are complete.
              </div>
              <div className="text-xs text-muted-foreground">
                Linked products update stock directly; manual lines can auto-create during receiving using these values.
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label>{t('purchases.discount')}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.discountAmount}
                  onChange={(e) => setForm((f) => ({ ...f, discountAmount: Number(e.target.value || 0) }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('purchases.tax')}</Label>
                <div className="h-10 flex items-center px-3 border rounded-md bg-muted/20">
                  {currency} {totalTax.toFixed(2)}
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('purchases.shipping')}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.shippingCost}
                  onChange={(e) => setForm((f) => ({ ...f, shippingCost: Number(e.target.value || 0) }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('purchases.otherCosts')}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.otherCosts}
                  onChange={(e) => setForm((f) => ({ ...f, otherCosts: Number(e.target.value || 0) }))}
                />
              </div>
              <div className="rounded-md border p-3 space-y-1 bg-muted/20">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="font-bold">
                  {currency}
                  {total.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Due: {currency}
                  {amountDue.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('purchases.notes')}</Label>
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Optional order note..."
              />
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t bg-background">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateOrder} disabled={saving}>
              {saving ? t('common.loading') : t('purchases.createOrder')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={receiveOpen}
        onOpenChange={(open) => {
          setReceiveOpen(open);
          if (!open) {
            setSelectedOrder(null);
            setReceiveMap({});
          } else if (selectedOrder) {
            // Pre-fill with remaining quantities
            const initialMap: Record<string, number> = {};
            selectedOrder.items.forEach(item => {
              const remaining = Math.max(0, Number(item.orderedQuantity || 0) - Number(item.receivedQuantity || 0));
              if (remaining > 0) {
                initialMap[item.id] = remaining;
              }
            });
            setReceiveMap(initialMap);
          }
        }}
      >
        <DialogContent className="w-[98vw] h-[95vh] max-w-[1600px] sm:max-w-[1600px] p-0 flex flex-col gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-4 border-b">
            <DialogTitle>{t('purchases.receiveItems')}{selectedOrder ? ` - ${selectedOrder.orderNumber}` : ''}</DialogTitle>
            <DialogDescription>
              {t('purchases.receiveDescription') || 'Complete your inventory update by confirming the exact quantities received from your supplier.'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {selectedOrder && (
              <div className="w-full space-y-6">
                  <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('purchases.supplierInformation') || 'SUPPLIER INFORMATION'}</p>
                      <p className="text-xl font-bold text-slate-900">{selectedOrder.supplierName}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="h-9 px-4 font-medium"
                        onClick={clearReceiveQtys}
                      >
                        {t('purchases.resetAll')}
                      </Button>
                      <Button 
                        variant="secondary" 
                        size="sm"
                        className="h-9 px-4 font-bold bg-white border border-slate-200 shadow-sm hover:bg-slate-50"
                        onClick={setReceiveToAllRemaining}
                      >
                        {t('purchases.receiveAllRemaining')}
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
                    <Table className="w-full">
                      <TableHeader className="bg-slate-50/50">
                        <TableRow className="hover:bg-transparent border-b">
                          <TableHead className="w-[40%] px-4 py-3 text-slate-500 font-semibold">{t('purchases.productName')}</TableHead>
                          <TableHead className="text-center px-4 py-3 text-slate-500 font-semibold">{t('purchases.ordered')}</TableHead>
                          <TableHead className="text-center px-4 py-3 text-slate-500 font-semibold">{t('purchases.received')}</TableHead>
                          <TableHead className="text-center px-4 py-3 text-slate-500 font-semibold">{t('purchases.remaining')}</TableHead>
                          <TableHead className="text-right px-4 py-3 text-slate-500 font-semibold w-[220px]">{t('purchases.receivingNow')}</TableHead>
                        </TableRow>
                      </TableHeader>
                    <TableBody>
                      {selectedOrder.items.map((item) => {
                        const ordered = Number(item.orderedQuantity || 0);
                        const received = Number(item.receivedQuantity || 0);
                        const remaining = Math.max(0, ordered - received);
                        const entering = Number(receiveMap[item.id] || 0);
                        const progress = ordered > 0 ? (received / ordered) * 100 : 0;

                        return (
                          <TableRow key={item.id} className="group hover:bg-slate-50">
                            <TableCell className="py-4">
                              <div className="flex flex-col gap-1">
                                <span className="font-medium text-slate-900">{item.productName}</span>
                                <div className="flex items-center gap-2">
                                  {item.sku && <Badge variant="secondary" className="text-[10px] h-4">{item.sku}</Badge>}
                                  <span className="text-[10px] text-slate-400">• {item.unit || t('purchases.piece')}</span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-medium text-slate-600">
                              {ordered}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-col gap-1.5 items-center">
                                <span className="text-sm font-semibold text-slate-900">{received}</span>
                                <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-emerald-500 transition-all duration-500" 
                                    style={{ width: `${progress}%` }}
                                  />
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge 
                                variant={remaining > 0 ? "outline" : "secondary"} 
                                className={cn(
                                  "text-[10px] font-bold px-2 py-0.5",
                                  remaining > 0 
                                    ? "text-amber-600 border-amber-200 bg-amber-50" 
                                    : "text-emerald-600 border-emerald-200 bg-emerald-50"
                                )}
                              >
                                {remaining} {t('purchases.remaining')}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right w-40">
                              <div className="flex flex-col items-end gap-1.5">
                                <div className="relative w-full">
                                  <Input
                                    type="number"
                                    value={receiveMap[item.id] || ''}
                                    onChange={(e) => {
                                      const val = e.target.value === '' ? 0 : Number(e.target.value);
                                      setReceiveMap(prev => ({
                                        ...prev,
                                        [item.id]: Math.max(0, val)
                                      }));
                                    }}
                                    className={cn(
                                      "h-9 text-right pr-3 font-semibold transition-all",
                                      entering > 0 ? "border-primary ring-1 ring-primary/20 bg-primary/[0.02]" : "bg-slate-50/50",
                                      entering > remaining && "border-amber-500 ring-amber-500/20 text-amber-700"
                                    )}
                                    placeholder={remaining > 0 ? `Max ${remaining}` : "0"}
                                  />
                                  {entering > 0 && (
                                    <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-slate-100 overflow-hidden rounded-full">
                                      <div 
                                        className={`h-full transition-all duration-300 ${entering > remaining ? 'bg-amber-500' : 'bg-primary'}`}
                                        style={{ width: `${Math.min(100, (entering / (remaining || 1)) * 100)}%` }}
                                      />
                                    </div>
                                  )}
                                </div>
                                {remaining > 0 && (
                                  <button 
                                    onClick={() => setReceiveMap(prev => ({ ...prev, [item.id]: remaining }))}
                                    className="text-[10px] font-bold text-primary hover:underline"
                                  >
                                    Receive all {remaining}
                                  </button>
                                )}
                                {entering > remaining && (
                                  <span className="text-[9px] font-bold text-amber-600 uppercase">
                                    Over-receiving
                                  </span>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex items-center justify-between rounded-md border p-4 bg-indigo-50/30 border-indigo-100">
                  <div className="space-y-2">
                    <p className="font-semibold text-indigo-600 flex items-center gap-3">
                      <Boxes className="size-5" />
                      {t('purchases.autoCreateInventoryItem')}
                    </p>
                    <p className="text-sm text-muted-foreground max-w-2xl">
                      Save time by automatically generating products in your main inventory database if they don't exist yet. This uses the details from your purchase order.
                    </p>
                  </div>
                  <Switch checked={autoCreateInventory} onCheckedChange={setAutoCreateInventory} />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t bg-background">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <FileText className="size-5" />
                </div>
                <div>
                  <p className="font-medium text-lg">{selectedOrder?.items.length} Items</p>
                  <p className="text-xs text-muted-foreground uppercase">Pending Confirmation</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Button variant="outline" onClick={() => setReceiveOpen(false)}>
                  Discard Changes
                </Button>
                <Button onClick={handleReceiveItems} disabled={receiving || !selectedOrder}>
                  {receiving ? t('common.loading') : t('purchases.confirmReceipt')}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
