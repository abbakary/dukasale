'use client';

import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  Users, 
  Download, 
  TrendingUp, 
  CreditCard, 
  UserCheck,
  Search,
  Calendar,
  Mail,
  Phone,
  Star
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/lib/stores/auth-store';
import { db } from '@/lib/db/dexie';
import { useI18n } from '@/lib/i18n/use-i18n';
import { cn } from '@/lib/utils';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, Cell } from 'recharts';

export default function CustomerReportPage() {
  const { company } = useAuthStore();
  const { t } = useI18n();
  const [period, setPeriod] = useState('this_month');
  const [searchQuery, setSearchQuery] = useState('');
  const currency = company?.currencySymbol || 'TSH';

  // 1. Fetch Data
  const customers = useLiveQuery(
    async () => {
      if (!company?.id) return [];
      return db.customers.where('companyId').equals(company.id).toArray();
    },
    [company?.id], []
  );

  const transactions = useLiveQuery(
    async () => {
      if (!company?.id) return [];
      return db.transactions
        .where('companyId')
        .equals(company.id)
        .filter(t => t.type === 'sale' && t.status === 'completed')
        .toArray();
    },
    [company?.id], []
  );

  // 2. Calculations
  const dateRange = useMemo(() => {
    const now = new Date();
    const start = new Date();
    if (period === 'today') start.setHours(0, 0, 0, 0);
    else if (period === 'this_week') { start.setDate(now.getDate() - now.getDay()); start.setHours(0, 0, 0, 0); }
    else if (period === 'this_month') { start.setDate(1); start.setHours(0, 0, 0, 0); }
    else if (period === 'this_year') { start.setMonth(0, 1); start.setHours(0, 0, 0, 0); }
    return { start, end: now };
  }, [period]);

  const filteredTransactions = useMemo(() => {
    return (transactions || []).filter(tx => {
      const date = new Date(tx.createdAt);
      return date >= dateRange.start && date <= dateRange.end;
    });
  }, [transactions, dateRange]);

  const stats = useMemo(() => {
    const active = (customers || []).filter(c => c.isActive).length;
    const withDebt = (customers || []).filter(c => c.currentDebt > 0).length;
    const totalDebt = (customers || []).reduce((sum, c) => sum + (c.currentDebt || 0), 0);
    const totalRevenue = filteredTransactions.reduce((sum, tx) => sum + tx.total, 0);

    // Group by customer
    const customerStats: Record<string, { id: string; name: string; total: number; count: number; lastActive: Date }> = {};
    filteredTransactions.forEach(tx => {
      const cId = tx.customerId || 'walk-in';
      const cName = tx.customerName || 'Walk-in Customer';
      if (!customerStats[cId]) {
        customerStats[cId] = { id: cId, name: cName, total: 0, count: 0, lastActive: new Date(tx.createdAt) };
      }
      customerStats[cId].total += tx.total;
      customerStats[cId].count += 1;
      const txDate = new Date(tx.createdAt);
      if (txDate > customerStats[cId].lastActive) customerStats[cId].lastActive = txDate;
    });

    const topCustomers = Object.values(customerStats)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    return {
      total: (customers || []).length,
      active,
      withDebt,
      totalDebt,
      totalRevenue,
      topCustomers
    };
  }, [customers, filteredTransactions]);

  const filteredCustomerList = useMemo(() => {
    return (customers || []).filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.phone && c.phone.includes(searchQuery))
    ).sort((a, b) => (b.currentDebt || 0) - (a.currentDebt || 0));
  }, [customers, searchQuery]);

  const colors = ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'];

  const handleExport = () => {
    // PDF Export logic would go here, matching the request for high-quality PDF
    window.print();
  };

  return (
    <div className="p-6 space-y-6 print:p-0">
      {/* Header */}
      <div className="rounded-xl border bg-gradient-to-r from-primary to-primary/80 px-5 py-4 text-primary-foreground shadow-sm no-print">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Customer Report</h1>
            <p className="text-primary-foreground/80">Analyze customer behavior and outstanding receivables</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-40 bg-white/10 border-white/20 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="this_week">This Week</SelectItem>
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="this_year">This Year</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="secondary" onClick={handleExport}>
              <Download className="mr-2 size-4" />
              Export PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase">Total Customers</CardTitle>
            <Users className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-900">{stats.total}</div>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">
              {stats.active} Active accounts
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase">Total Receivables</CardTitle>
            <CreditCard className="size-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-red-600">{currency}{stats.totalDebt.toLocaleString()}</div>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">
              From {stats.withDebt} Customers
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase">Period Revenue</CardTitle>
            <TrendingUp className="size-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-emerald-600">{currency}{stats.totalRevenue.toLocaleString()}</div>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">
              {filteredTransactions.length} Transactions
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase">Customer Health</CardTitle>
            <UserCheck className="size-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-blue-600">
              {stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}%
            </div>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">
              Retention Rate
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Customers Chart */}
        <Card className="border-none shadow-sm bg-white">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-900">Top 10 Customers</CardTitle>
            <CardDescription>By revenue generated in the selected period</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px]">
            {stats.topCustomers.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.topCustomers} layout="vertical" margin={{ left: 40, right: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={100} 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                  />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white p-3 border rounded-lg shadow-xl">
                            <p className="font-bold text-slate-900">{payload[0].payload.name}</p>
                            <p className="text-primary font-black mt-1">
                              {currency}{Number(payload[0].value).toLocaleString()}
                            </p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                              {payload[0].payload.count} Visits
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]} barSize={24}>
                    {stats.topCustomers.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <Users className="size-12 mb-2 opacity-20" />
                <p className="font-medium">No customer data for this period</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Customer Balances Table */}
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold text-slate-900">Outstanding Balances</CardTitle>
              <CardDescription>Customers with the highest debt</CardDescription>
            </div>
            <div className="relative w-48 no-print">
              <Search className="absolute left-2.5 top-2.5 size-4 text-slate-400" />
              <Input
                placeholder="Search..."
                className="pl-9 h-9 text-xs"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
              <Table>
                <TableHeader className="sticky top-0 bg-white z-10">
                  <TableRow className="hover:bg-transparent border-slate-100">
                    <TableHead className="text-[10px] font-bold text-slate-400 uppercase">Customer</TableHead>
                    <TableHead className="text-[10px] font-bold text-slate-400 uppercase text-right">Balance</TableHead>
                    <TableHead className="text-[10px] font-bold text-slate-400 uppercase text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomerList.filter(c => c.currentDebt > 0).length > 0 ? (
                    filteredCustomerList.filter(c => c.currentDebt > 0).map((c) => (
                      <TableRow key={c.id} className="border-slate-50 hover:bg-slate-50/50">
                        <TableCell className="py-3">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-700">{c.name}</span>
                            <span className="text-[10px] text-slate-400">{c.phone || 'No phone'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right py-3">
                          <span className="text-sm font-black text-red-600">
                            {currency}{c.currentDebt.toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell className="text-center py-3">
                          <Badge className="bg-red-50 text-red-600 border-red-100 text-[10px] px-2 py-0">
                            Debt
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-12 text-slate-400">
                        No outstanding balances found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detail Table */}
      <Card className="border-none shadow-sm bg-white overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold text-slate-900">Customer Activity Detail</CardTitle>
              <CardDescription>Comprehensive list of customers and their engagement</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="hover:bg-transparent border-slate-100">
                <TableHead className="text-[10px] font-bold text-slate-400 uppercase pl-6">Customer Name</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 uppercase">Contact</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 uppercase text-center">Price Level</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 uppercase text-right">Total Spent</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 uppercase text-right">Current Balance</TableHead>
                <TableHead className="text-[10px] font-bold text-slate-400 uppercase pr-6 text-right">Loyalty Points</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomerList.length > 0 ? (
                filteredCustomerList.slice(0, 50).map((c) => {
                  const customerRevenue = filteredTransactions
                    .filter(tx => tx.customerId === c.id)
                    .reduce((sum, tx) => sum + tx.total, 0);

                  return (
                    <TableRow key={c.id} className="border-slate-50 hover:bg-slate-50/50 group">
                      <TableCell className="py-4 pl-6">
                        <span className="text-sm font-bold text-slate-900 group-hover:text-primary transition-colors">
                          {c.name}
                        </span>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex flex-col text-[11px] text-slate-500">
                          <span className="flex items-center gap-1"><Phone className="size-2.5" /> {c.phone || 'N/A'}</span>
                          <span className="flex items-center gap-1"><Mail className="size-2.5" /> {c.email || 'N/A'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 text-center">
                        <Badge variant="outline" className={cn(
                          "text-[10px] font-bold uppercase px-2 py-0",
                          c.priceLevel === 'vip' ? "bg-amber-50 text-amber-600 border-amber-100" :
                          c.priceLevel === 'wholesale' ? "bg-blue-50 text-blue-600 border-blue-100" :
                          "bg-slate-50 text-slate-500 border-slate-100"
                        )}>
                          {c.priceLevel}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4 text-right font-bold text-slate-700">
                        {currency}{customerRevenue.toLocaleString()}
                      </TableCell>
                      <TableCell className="py-4 text-right">
                        <span className={cn(
                          "text-sm font-black",
                          (c.currentDebt || 0) > 0 ? "text-red-600" : (c.currentDebt || 0) < 0 ? "text-green-600" : "text-slate-300"
                        )}>
                          {currency}{Math.abs(c.currentDebt || 0).toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell className="py-4 text-right pr-6">
                        <div className="flex items-center justify-end gap-1.5">
                          <Star className="size-3 text-warning fill-warning" />
                          <span className="text-sm font-bold text-slate-700">{(c.loyaltyPoints || 0).toLocaleString()}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-20 text-slate-400">
                    No customers found matching your criteria
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Print-only Footer */}
      <div className="hidden print:block mt-12 pt-8 border-t text-center text-slate-400 text-xs">
        <p>Generated by {company?.name} Management System on {new Date().toLocaleString()}</p>
        <p className="mt-1">CONFIDENTIAL FINANCIAL DOCUMENT</p>
      </div>

      <style jsx global>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .print\:p-0 { padding: 0 !important; }
          .shadow-sm, .shadow-xl { shadow: none !important; }
          .border-none { border: 1px solid #f1f5f9 !important; }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f8fafc;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
}
