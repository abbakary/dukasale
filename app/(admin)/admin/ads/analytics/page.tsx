'use client';

import { useEffect, useState } from 'react';
import { BarChart3, Target, LayoutGrid, Megaphone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/lib/stores/auth-store';
import { getAdAnalyticsApi } from '@/lib/api/admin-ads';
import { Bar, BarChart, CartesianGrid, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell, LineChart, Line } from 'recharts';

const COLORS = ['#2563eb', '#7c3aed', '#10b981', '#f97316', '#ef4444'];

export default function AdminAdsAnalyticsPage() {
  const { token } = useAuthStore();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!token) return;
    getAdAnalyticsApi(token).then(setData).catch(() => setData(null));
  }, [token]);

  if (!data) {
    return <div className="p-6">Loading ad analytics...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ad Analytics</h1>
        <p className="text-muted-foreground">Detailed campaign performance by status, target, placement, and timeline.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Ads</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{data.summary.total_ads}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Active</CardTitle></CardHeader><CardContent className="text-2xl font-bold text-green-600">{data.summary.active_ads}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Scheduled</CardTitle></CardHeader><CardContent className="text-2xl font-bold text-blue-600">{data.summary.scheduled_ads}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Ended / Paused</CardTitle></CardHeader><CardContent className="text-2xl font-bold text-amber-600">{data.summary.ended_ads + data.summary.paused_ads}</CardContent></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-5">
          <CardHeader><CardTitle className="flex items-center gap-2"><Target className="size-4" />Target Breakdown</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.target_breakdown} dataKey="count" nameKey="target" outerRadius={95} label>
                  {data.target_breakdown.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-7">
          <CardHeader><CardTitle className="flex items-center gap-2"><LayoutGrid className="size-4" />Placement Breakdown</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.placement_breakdown}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="placement" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#7c3aed" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="size-4" />Campaign Timeline</CardTitle></CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.timeline}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2.5} name="Created" />
              <Line type="monotone" dataKey="active" stroke="#10b981" strokeWidth={2.5} name="Active" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Megaphone className="size-4" />Recent Campaigns</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(data.ads || []).slice(0, 8).map((ad: any) => (
            <div key={ad.id} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">{ad.title}</p>
                <p className="text-xs text-muted-foreground">{ad.target} - {(ad.placements || []).join(', ')}</p>
              </div>
              <span className={`text-xs font-semibold ${ad.is_active ? 'text-green-600' : 'text-amber-600'}`}>{ad.is_active ? 'Active' : 'Paused'}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

