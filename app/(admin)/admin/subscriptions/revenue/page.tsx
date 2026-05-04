'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/lib/stores/auth-store';
import { getAdminSubscriptionRevenueApi } from '@/lib/api/admin-system';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar } from 'recharts';

export default function SubscriptionRevenuePage() {
  const { token } = useAuthStore();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!token) return;
    getAdminSubscriptionRevenueApi(token).then(setData).catch(() => setData(null));
  }, [token]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Subscription Revenue</h1>
        <p className="text-muted-foreground">Revenue and trend from active subscriptions.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Revenue</CardTitle></CardHeader><CardContent className="text-2xl font-bold">TSh {Number(data?.total_revenue || 0).toLocaleString()}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Period</CardTitle></CardHeader><CardContent className="text-lg font-semibold">{data?.period || 'this_month'}</CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Revenue Trend</CardTitle></CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.trend || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="revenue" fill="#2563eb" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

