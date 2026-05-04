'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, TrendingUp, TrendingDown, Banknote, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuthStore } from '@/lib/stores/auth-store';
import { listTenantResource } from '@/lib/api/tenant';
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  Legend,
} from 'recharts';

export default function FinancialReportPage() {
  const { company, token } = useAuthStore();
  const [period, setPeriod] = useState('this_month');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [debts, setDebts] = useState<any[]>([]);
  const [salaries, setSalaries] = useState<any[]>([]);
  const [expenditures, setExpenditures] = useState<any[]>([]);
  const currency = company?.currencySymbol || 'TSH';

  useEffect(() => {
    if (!token) return;
    Promise.all([
      listTenantResource<any>('transactions', token),
      listTenantResource<any>('debts', token),
      listTenantResource<any>('staff_salaries', token),
      listTenantResource<any>('expenditures', token),
    ])
      .then(([tx, dbt, sal, exp]) => {
        setTransactions(tx || []);
        setDebts(dbt || []);
        setSalaries(sal || []);
        setExpenditures(exp || []);
      })
      .catch(() => {
        setTransactions([]);
        setDebts([]);
        setSalaries([]);
        setExpenditures([]);
      });
  }, [token]);

  const getStart = () => {
    const now = new Date();
    const s = new Date();
    if (period === 'today') s.setHours(0, 0, 0, 0);
    else if (period === 'this_week') { s.setDate(now.getDate() - now.getDay()); s.setHours(0, 0, 0, 0); }
    else if (period === 'this_month') { s.setDate(1); s.setHours(0, 0, 0, 0); }
    else if (period === 'this_year') { s.setMonth(0, 1); s.setHours(0, 0, 0, 0); }
    return s;
  };

  const start = getStart();
  const filteredSales = useMemo(
    () => transactions.filter(t => t.type === 'sale' && new Date(t.created_at) >= start),
    [transactions, start]
  );
  const filteredReturns = useMemo(
    () => transactions.filter(t => t.type === 'return' && new Date(t.created_at) >= start),
    [transactions, start]
  );
  const filteredSalaries = useMemo(
    () => salaries.filter(s => new Date(s.payment_date) >= start),
    [salaries, start]
  );
  const filteredExpenditures = useMemo(
    () => expenditures.filter(e => new Date(e.date) >= start),
    [expenditures, start]
  );

  const revenue = filteredSales.reduce((s, t) => s + Number(t.total || 0), 0);
  const returnAmount = filteredReturns.reduce((s, t) => s + Number(t.total || 0), 0);
  const netRevenue = revenue - returnAmount;
  const cogs = filteredSales.reduce(
    (s, t) =>
      s +
      (t.items || []).reduce(
        (is: number, i: any) => is + Number(i.costPrice ?? i.cost_price ?? 0) * Number(i.quantity ?? 0),
        0
      ),
    0
  );
  const salaryTotal = filteredSalaries.reduce((s, row) => s + Number(row.amount || 0), 0);
  const expenditureTotal = filteredExpenditures.reduce((s, row) => s + Number(row.amount || 0), 0);
  const operatingExpenses = salaryTotal + expenditureTotal;
  const grossProfit = netRevenue - cogs;
  const netProfit = grossProfit - operatingExpenses;
  const grossMargin = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;

  const totalReceivables = debts.filter(d => d.type === 'receivable' && d.status !== 'paid').reduce((s, d) => s + Number(d.remaining_amount || 0), 0);
  const totalPayables = debts.filter(d => d.type === 'payable' && d.status !== 'paid').reduce((s, d) => s + Number(d.remaining_amount || 0), 0);
  const moneyIn = filteredSales.reduce((s, t) => s + Number(t.amount_paid || 0), 0);
  const moneyOut = operatingExpenses;
  const cashFlow = moneyIn - moneyOut;

  const monthlyData: { month: string; revenue: number; profit: number; expenses: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const monthSales = transactions.filter(t => {
      const td = new Date(t.created_at);
      return t.type === 'sale' && td >= monthStart && td < monthEnd;
    });
    const monthReturns = transactions.filter(t => {
      const td = new Date(t.created_at);
      return t.type === 'return' && td >= monthStart && td < monthEnd;
    });
    const monthSalaries = salaries.filter(s => {
      const sd = new Date(s.payment_date);
      return sd >= monthStart && sd < monthEnd;
    });
    const monthExpenditures = expenditures.filter(e => {
      const ed = new Date(e.date);
      return ed >= monthStart && ed < monthEnd;
    });
    const mRevenue = monthSales.reduce((s, t) => s + Number(t.total || 0), 0);
    const mReturns = monthReturns.reduce((s, t) => s + Number(t.total || 0), 0);
    const mCogs = monthSales.reduce(
      (s, t) =>
        s +
        (t.items || []).reduce((is: number, i: any) => {
          const unitCost = Number(i.costPrice ?? i.cost_price ?? 0);
          const qty = Number(i.quantity ?? 0);
          return is + unitCost * qty;
        }, 0),
      0
    );
    const mExpenses = monthSalaries.reduce((s, row) => s + Number(row.amount || 0), 0) + monthExpenditures.reduce((s, row) => s + Number(row.amount || 0), 0);
    monthlyData.push({
      month: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      revenue: mRevenue - mReturns,
      profit: mRevenue - mReturns - mCogs - mExpenses,
      expenses: mExpenses,
    });
  }

  const expenseBreakdown = [
    { name: 'Salaries', value: salaryTotal },
    { name: 'Other Expenses', value: expenditureTotal },
    { name: 'COGS', value: cogs },
  ].filter(i => i.value > 0);
  const expenseColors = ['#2563eb', '#dc2626', '#f59e0b'];

  const insights = [
    cashFlow < 0 ? 'Cash out is higher than cash in for this period.' : 'Cash flow is positive for this period.',
    netProfit < 0 ? 'Net profit is negative. Reduce costs or improve margin.' : 'Net profit is positive.',
    netRevenue > 0 && salaryTotal / netRevenue >= 0.4 ? 'Salaries are above 40% of revenue.' : 'Salary-to-revenue ratio is within normal range.',
  ];

  const handleExport = () => {
    window.print();
  };

  return (
    <div className="p-6 space-y-6 print:p-0">
      <div className="rounded-xl border bg-gradient-to-r from-primary to-primary/80 px-5 py-4 text-primary-foreground shadow-sm no-print">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Financial Report</h1>
          <p className="text-primary-foreground/80">Profit & loss, cash flow, and financial summary</p>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40 bg-white/10 border-white/20 text-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="this_week">This Week</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="this_year">This Year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="secondary" onClick={handleExport}><Download className="mr-2 size-4" />Export PDF</Button>
        </div>
      </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase">Net Revenue</CardTitle>
            <Banknote className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-900">{currency}{netRevenue.toLocaleString(undefined, { minimumFractionDigits: 0 })}</div>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">After {currency}{returnAmount.toLocaleString()} returns</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase">Net Profit</CardTitle>
            <TrendingUp className="size-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-black ${netProfit >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
              {currency}{netProfit.toLocaleString(undefined, { minimumFractionDigits: 0 })}
            </div>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">{grossMargin.toFixed(1)}% gross margin</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase">Receivables</CardTitle>
            <CreditCard className="size-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-red-600">{currency}{totalReceivables.toLocaleString()}</div>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Owed to you</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 uppercase">Cash Flow</CardTitle>
            <TrendingDown className="size-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-black ${cashFlow >= 0 ? 'text-blue-600' : 'text-destructive'}`}>
              {currency}{cashFlow.toLocaleString(undefined, { minimumFractionDigits: 0 })}
            </div>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Net movement</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-none shadow-sm bg-white">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-900">P&L Summary</CardTitle>
            <CardDescription>Profit and loss breakdown</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: 'Gross Revenue', value: revenue, color: 'text-slate-700 font-medium' },
              { label: 'Returns & Refunds', value: -returnAmount, color: 'text-red-500' },
              { label: 'Net Revenue', value: netRevenue, color: 'text-slate-900 font-bold border-t border-slate-100 pt-3' },
              { label: 'Cost of Goods Sold (COGS)', value: -cogs, color: 'text-red-500' },
              { label: 'Staff Salaries', value: -salaryTotal, color: 'text-red-500' },
              { label: 'Operating Expenditures', value: -expenditureTotal, color: 'text-red-500' },
              { label: 'Net Profit', value: netProfit, color: netProfit >= 0 ? 'text-emerald-600 font-black border-t border-slate-100 pt-3' : 'text-red-600 font-black border-t border-slate-100 pt-3' },
            ].map((row, i) => (
              <div key={i} className={`flex justify-between text-sm ${row.color}`}>
                <span>{row.label}</span>
                <span>{currency}{Math.abs(row.value).toLocaleString()}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-900">Monthly Trend</CardTitle>
            <CardDescription>Performance over last 6 months</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip />
                <Line type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="profit" stroke="#16a34a" strokeWidth={3} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="expenses" stroke="#dc2626" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-900">Expense Breakdown</CardTitle>
            <CardDescription>Where your money goes</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie 
                  data={expenseBreakdown.filter(i => i.value > 0)} 
                  dataKey="value" 
                  nameKey="name" 
                  outerRadius={100}
                  innerRadius={60}
                  paddingAngle={5}
                  label={false}
                >
                  {expenseBreakdown.filter(i => i.value > 0).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={expenseColors[index % expenseColors.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [`${currency}${value.toLocaleString()}`, 'Amount']}
                />
                <Legend 
                  verticalAlign="bottom" 
                  align="center"
                  iconType="circle"
                  formatter={(value, entry: any) => {
                    const { payload } = entry;
                    const percent = ((payload.value / expenseBreakdown.reduce((s, i) => s + i.value, 0)) * 100).toFixed(0);
                    return <span className="text-[11px] font-bold text-slate-600 uppercase tracking-tight">{value} ({percent}%)</span>;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-900">Smart Insights</CardTitle>
            <CardDescription>Decision support from current period</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {insights.map((item, idx) => (
              <div key={idx} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 text-sm font-medium text-slate-700 flex items-start gap-3">
                <div className="size-2 rounded-full bg-primary mt-1.5 shrink-0" />
                {item}
              </div>
            ))}
            <div className="rounded-xl bg-primary/5 p-4 text-sm border border-primary/10">
              <p className="text-[10px] font-bold text-primary uppercase mb-1">Outstanding payable</p>
              <p className="text-lg font-black text-primary">{currency}{totalPayables.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      </div>

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
          .shadow-sm { shadow: none !important; }
          .border-none { border: 1px solid #f1f5f9 !important; }
        }
      `}</style>
    </div>
  );
}
