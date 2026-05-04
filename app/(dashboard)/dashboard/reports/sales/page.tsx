'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Download, TrendingUp, ShoppingCart, Banknote, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/lib/stores/auth-store';
import { db } from '@/lib/db/dexie';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar } from 'recharts';
import { useI18n } from '@/lib/i18n/use-i18n';
import { cn } from '@/lib/utils';

export default function SalesReportPage() {
  const { user, company } = useAuthStore();
  const { t } = useI18n();
  const [period, setPeriod] = useState('this_month');
  const currency = company?.currencySymbol || 'TSH';

  const isCashier = user?.role === 'cashier';

  const transactions = useLiveQuery(
    async () => {
      if (!company?.id) return [];
      let query = db.transactions.where('companyId').equals(company.id).filter(t => t.type === 'sale');
      
      const all = await query.reverse().toArray();
      
      if (isCashier && user?.id) {
        return all.filter(t => t.cashierId === user.id);
      }
      return all;
    },
    [company?.id, isCashier, user?.id], []
  );

  const getDateRange = () => {
    const now = new Date();
    const start = new Date();
    if (period === 'today') { start.setHours(0, 0, 0, 0); }
    else if (period === 'this_week') { start.setDate(now.getDate() - now.getDay()); start.setHours(0, 0, 0, 0); }
    else if (period === 'this_month') { start.setDate(1); start.setHours(0, 0, 0, 0); }
    else if (period === 'last_month') { start.setMonth(now.getMonth() - 1, 1); start.setHours(0, 0, 0, 0); now.setDate(0); }
    else if (period === 'this_year') { start.setMonth(0, 1); start.setHours(0, 0, 0, 0); }
    return { start, end: now };
  };

  const { start, end } = getDateRange();
  const filtered = (transactions || []).filter(t => {
    const d = new Date(t.createdAt);
    return d >= start && d <= end;
  });

  const completed = filtered.filter(t => t.status === 'completed');
  const revenue = completed.reduce((s, t) => s + t.total, 0);
  const cost = completed.reduce((s, t) => s + t.items.reduce((is, i) => is + i.costPrice * i.quantity, 0), 0);
  const profit = revenue - cost;

  // Top products
  const productMap: Record<string, { name: string; qty: number; revenue: number }> = {};
  completed.forEach(t => t.items.forEach(item => {
    if (!productMap[item.productId]) productMap[item.productId] = { name: item.productName, qty: 0, revenue: 0 };
    productMap[item.productId].qty += item.quantity;
    productMap[item.productId].revenue += item.total;
  }));
  const topProducts = Object.values(productMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

  // By payment method
  const byMethod: Record<string, number> = {};
  completed.forEach(t => { byMethod[t.paymentMethod] = (byMethod[t.paymentMethod] || 0) + t.total; });
  const trend = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().split('T')[0];
    const daySales = completed.filter(t => new Date(t.createdAt).toISOString().split('T')[0] === key);
    return {
      day: d.toLocaleDateString('en-US', { weekday: 'short' }),
      revenue: daySales.reduce((s, t) => s + t.total, 0),
      orders: daySales.length,
    };
  });

  const handleExport = () => {
    window.print();
  };

  return (
    <div className="p-6 space-y-6 print:p-0">
      <div className="rounded-xl border bg-gradient-to-r from-primary to-primary/80 px-5 py-4 text-primary-foreground shadow-sm no-print">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('reports.salesReportTitle')}</h1>
          <p className="text-primary-foreground/80">{t('reports.salesReportSubtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40 bg-white/10 border-white/20 text-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">{t('reports.today')}</SelectItem>
              <SelectItem value="this_week">{t('reports.thisWeek')}</SelectItem>
              <SelectItem value="this_month">{t('reports.thisMonth')}</SelectItem>
              <SelectItem value="last_month">{t('reports.lastMonth')}</SelectItem>
              <SelectItem value="this_year">{t('reports.thisYear')}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="secondary" onClick={handleExport}><Download className="mr-2 size-4" />{t('reports.export')} PDF</Button>
        </div>
      </div>
      </div>

      <div className={`grid gap-4 ${isCashier ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4'}`}>
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase">
              {isCashier ? t('reports.mySalesCount') : t('reports.totalSales')}
            </CardTitle>
            <ShoppingCart className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-900">{completed.length}</div>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">{filtered.length} {t('reports.totalTransactions')}</p>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase">
              {isCashier ? t('reports.myRevenue') : t('reports.totalRevenue')}
            </CardTitle>
            <Banknote className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-900">{currency}{revenue.toLocaleString(undefined, { minimumFractionDigits: 0 })}</div>
          </CardContent>
        </Card>

        {!isCashier && (
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold text-slate-500 uppercase">{t('reports.netProfit')}</CardTitle>
              <TrendingUp className="size-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-black ${profit >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                {currency}{profit.toLocaleString(undefined, { minimumFractionDigits: 0 })}
              </div>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">{revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : 0}% {t('dashboard.margin')}</p>
            </CardContent>
          </Card>
        )}

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase">{t('reports.avgOrderValue')}</CardTitle>
            <Users className="size-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-blue-600">
              {currency}{completed.length > 0 ? (revenue / completed.length).toLocaleString(undefined, { minimumFractionDigits: 0 }) : '0'}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-none shadow-sm bg-white">
          <CardHeader><CardTitle className="text-lg font-bold text-slate-900">{t('reports.salesTrend7d')}</CardTitle><CardDescription>{t('reports.revenueAndOrders')}</CardDescription></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip cursor={{fill: '#f8fafc'}} />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white">
          <CardHeader><CardTitle className="text-lg font-bold text-slate-900">{t('reports.topProducts')}</CardTitle><CardDescription>{t('reports.bestSellingByRevenue')}</CardDescription></CardHeader>
          <CardContent>
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="hover:bg-transparent border-slate-100">
                  <TableHead className="text-[10px] font-bold text-slate-400 uppercase">{t('reports.product')}</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-400 uppercase text-right">{t('reports.qtySold')}</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-400 uppercase text-right">{t('reports.totalRevenue')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topProducts.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">{t('reports.noDataPeriod')}</TableCell></TableRow>
                ) : topProducts.map((p, i) => (
                  <TableRow key={i} className="border-slate-50">
                    <TableCell className="font-bold text-slate-700">{p.name}</TableCell>
                    <TableCell className="text-right text-slate-600 font-medium">{p.qty}</TableCell>
                    <TableCell className="text-right font-black text-slate-900">{currency}{p.revenue.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader><CardTitle className="text-lg font-bold text-slate-900">{t('reports.paymentMethods')}</CardTitle><CardDescription>{t('reports.paymentBreakdown')}</CardDescription></CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(byMethod).length === 0 ? (
                <p className="text-center py-6 text-muted-foreground">{t('reports.noDataPeriod')}</p>
              ) : Object.entries(byMethod).map(([method, amount]) => (
                <div key={method} className="flex items-center justify-between border-b border-slate-50 pb-3 last:border-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize font-bold text-slate-600">{method}</Badge>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-slate-900">{currency}{amount.toLocaleString()}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{revenue > 0 ? ((amount / revenue) * 100).toFixed(1) : 0}%</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm bg-white overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100">
          <CardTitle className="text-lg font-bold text-slate-900">{t('reports.allTransactions')}</CardTitle>
          <CardDescription>{filtered.length} {t('reports.transactionsInSelected')}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="hover:bg-transparent border-slate-100">
                <TableHead className="text-[10px] font-bold text-slate-400 uppercase pl-6">{t('reports.transactionNo')}</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 uppercase">{t('reports.customer')}</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 uppercase text-center">{t('reports.items')}</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 uppercase">{t('reports.payment')}</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 uppercase text-right">{t('purchases.total')}</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 uppercase text-center">{t('reports.status')}</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 uppercase pr-6 text-right">{t('reports.date')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">{t('reports.noTransactionsPeriod')}</TableCell></TableRow>
              ) : filtered.slice(0, 50).map(tx => (
                <TableRow key={tx.id} className="border-slate-50 hover:bg-slate-50/50">
                  <TableCell className="font-mono text-[11px] font-bold text-primary pl-6">{tx.transactionNumber}</TableCell>
                  <TableCell className="text-sm font-medium text-slate-700">{tx.customerName || t('reports.walkIn')}</TableCell>
                  <TableCell className="text-center text-sm font-bold text-slate-500">{tx.items.length}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize text-[10px] font-bold border-slate-200">{tx.paymentMethod}</Badge></TableCell>
                  <TableCell className="text-right font-black text-slate-900">{currency}{tx.total.toLocaleString()}</TableCell>
                  <TableCell className="text-center">
                    <Badge className={cn(
                      "text-[10px] font-bold uppercase px-2 py-0",
                      tx.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                    )}>
                      {tx.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right pr-6 text-[11px] font-bold text-slate-400">{new Date(tx.createdAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Print-only Footer */}
      <div className="hidden print:block mt-12 pt-8 border-t text-center text-slate-400 text-xs">
        <p>Generated by {company?.name} Management System on {new Date().toLocaleString()}</p>
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
