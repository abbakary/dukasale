'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { Download, Package, AlertTriangle, TrendingDown, Banknote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { useAuthStore } from '@/lib/stores/auth-store';
import { db } from '@/lib/db/dexie';
import { ResponsiveContainer, PieChart, Pie, Tooltip, Cell } from 'recharts';
import { useI18n } from '@/lib/i18n/use-i18n';
import { cn } from '@/lib/utils';

export default function InventoryReportPage() {
  const { company } = useAuthStore();
  const { t } = useI18n();
  const currency = company?.currencySymbol || 'TSH';

  const products = useLiveQuery(
    async () => {
      if (!company?.id) return [];
      return db.products.where('companyId').equals(company.id).filter(p => p.isActive).toArray();
    },
    [company?.id], []
  );

  const categories = useLiveQuery(
    async () => {
      if (!company?.id) return [];
      return db.categories.where('companyId').equals(company.id).toArray();
    },
    [company?.id], []
  );

  const getCategoryName = (id: string) => (categories || []).find(c => c.id === id)?.name || t('reports.uncategorized');

  const totalValue = (products || []).reduce((s, p) => s + p.costPrice * p.quantity, 0);
  const totalRetailValue = (products || []).reduce((s, p) => s + p.sellingPrice * p.quantity, 0);
  const lowStock = (products || []).filter(p => p.quantity <= p.minStock && p.quantity > 0);
  const outOfStock = (products || []).filter(p => p.quantity === 0);
  const expiring = (products || []).filter(p => {
    if (!p.expiryDate) return false;
    const days = Math.ceil((new Date(p.expiryDate).getTime() - Date.now()) / 86400000);
    return days <= 30 && days > 0;
  });

  // By category
  const byCat: Record<string, { name: string; count: number; value: number }> = {};
  (products || []).forEach(p => {
    const name = getCategoryName(p.categoryId);
    if (!byCat[p.categoryId]) byCat[p.categoryId] = { name, count: 0, value: 0 };
    byCat[p.categoryId].count++;
    byCat[p.categoryId].value += p.costPrice * p.quantity;
  });
  const catList = Object.values(byCat).sort((a, b) => b.value - a.value);
  const categoryChart = catList.slice(0, 6).map((c) => ({ name: c.name, value: c.value }));
  const colors = ['#2563eb', '#0891b2', '#f59e0b', '#16a34a', '#7c3aed', '#dc2626'];

  const handleExport = () => {
    window.print();
  };

  return (
    <div className="p-6 space-y-6 print:p-0">
      <div className="rounded-xl border bg-gradient-to-r from-primary to-primary/80 px-5 py-4 text-primary-foreground shadow-sm no-print">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('reports.inventoryReportTitle')}</h1>
          <p className="text-primary-foreground/80">{t('reports.inventoryReportSubtitle')}</p>
        </div>
        <Button variant="secondary" onClick={handleExport}><Download className="mr-2 size-4" />{t('reports.export')} PDF</Button>
      </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase">{t('reports.totalProducts')}</CardTitle>
            <Package className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-900">{(products || []).length}</div>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase">{t('reports.stockValueCost')}</CardTitle>
            <Banknote className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-900">{currency}{totalValue.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase">{t('reports.lowStockItems')}</CardTitle>
            <AlertTriangle className="size-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-amber-600">{lowStock.length}</div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase">{t('reports.outOfStock')}</CardTitle>
            <TrendingDown className="size-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-red-600">{outOfStock.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold text-slate-900">{t('reports.lowStockAlert')}</CardTitle>
              <CardDescription>{t('reports.productsNeedRestocking')}</CardDescription>
            </div>
            <Badge variant="destructive" className="animate-pulse">{[...outOfStock, ...lowStock].length}</Badge>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
              <Table>
                <TableHeader className="bg-slate-50/50 sticky top-0 z-10">
                  <TableRow className="hover:bg-transparent border-slate-100">
                    <TableHead className="text-[10px] font-bold text-slate-400 uppercase pl-6">{t('reports.product')}</TableHead>
                    <TableHead className="text-[10px] font-bold text-slate-400 uppercase text-right">{t('reports.currentStock')}</TableHead>
                    <TableHead className="text-[10px] font-bold text-slate-400 uppercase text-center">{t('reports.status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...outOfStock, ...lowStock].length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center py-12 text-slate-400">{t('reports.allWellStocked')}</TableCell></TableRow>
                  ) : [...outOfStock, ...lowStock].map(p => (
                    <TableRow key={p.id} className="border-slate-50 hover:bg-slate-50/50 group">
                      <TableCell className="py-4 pl-6">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-700">{p.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono uppercase">{p.sku}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right py-4 font-black text-red-600">
                        {p.quantity} {p.unit}
                      </TableCell>
                      <TableCell className="text-center py-4">
                        <Badge variant="destructive" className="text-[10px] font-bold uppercase px-2 py-0">
                          {p.quantity === 0 ? t('reports.outOfStock') : t('reports.lowStockItems')}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <CardTitle className="text-lg font-bold text-slate-900">{t('reports.expiringSoon')}</CardTitle>
            <CardDescription>{t('reports.expiringWithin30')}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
              <Table>
                <TableHeader className="bg-slate-50/50 sticky top-0 z-10">
                  <TableRow className="hover:bg-transparent border-slate-100">
                    <TableHead className="text-[10px] font-bold text-slate-400 uppercase pl-6">{t('reports.product')}</TableHead>
                    <TableHead className="text-[10px] font-bold text-slate-400 uppercase text-right">{t('reports.stock')}</TableHead>
                    <TableHead className="text-[10px] font-bold text-slate-400 uppercase text-right pr-6">{t('reports.expires')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expiring.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center py-12 text-slate-400">No products expiring soon</TableCell></TableRow>
                  ) : expiring.map(p => {
                    const days = Math.ceil((new Date(p.expiryDate!).getTime() - Date.now()) / 86400000);
                    return (
                      <TableRow key={p.id} className="border-slate-50 hover:bg-slate-50/50">
                        <TableCell className="py-4 pl-6 font-bold text-slate-700">{p.name}</TableCell>
                        <TableCell className="text-right py-4 font-bold text-slate-500">{p.quantity} {p.unit}</TableCell>
                        <TableCell className="text-right py-4 pr-6">
                          <Badge className={cn(
                            "text-[10px] font-bold uppercase px-2 py-0",
                            days <= 7 ? 'bg-red-50 text-red-600 border-red-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                          )}>
                            {days} {t('reports.daysLeft')}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-none shadow-sm bg-white">
          <CardHeader><CardTitle className="text-lg font-bold text-slate-900">{t('reports.inventoryValueMix')}</CardTitle><CardDescription>{t('reports.topCategoriesByValue')}</CardDescription></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categoryChart} dataKey="value" nameKey="name" outerRadius={96} label>
                  {categoryChart.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white">
          <CardHeader><CardTitle className="text-lg font-bold text-slate-900">{t('reports.stockByCategory')}</CardTitle><CardDescription>{t('reports.valueDistributionByCategory')}</CardDescription></CardHeader>
          <CardContent className="space-y-5">
            {catList.length === 0 ? <p className="text-center py-6 text-muted-foreground">{t('reports.noData')}</p> : catList.map((cat, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-700">{cat.name}</span>
                  <span className="text-slate-400 uppercase">{cat.count} items · {currency}{cat.value.toLocaleString()}</span>
                </div>
                <Progress value={totalValue > 0 ? (cat.value / totalValue) * 100 : 0} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Print-only Footer */}
      <div className="hidden print:block mt-12 pt-8 border-t text-center text-slate-400 text-xs">
        <p>Generated by {company?.name} Management System on {new Date().toLocaleString()}</p>
        <p className="mt-1">INVENTORY STATUS REPORT</p>
      </div>

      <style jsx global>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .print\:p-0 { padding: 0 !important; }
          .shadow-sm { shadow: none !important; }
          .border-none { border: 1px solid #f1f5f9 !important; }
        }
      `}</style>
    </div>
  );
}
