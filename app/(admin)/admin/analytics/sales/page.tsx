'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/lib/stores/auth-store';
import { getAdminAnalyticsOverviewApi } from '@/lib/api/admin-analytics';
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Line } from 'recharts';

export default function AnalyticsSalesPage() {
  const { token } = useAuthStore();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!token) return;
    getAdminAnalyticsOverviewApi(token, 'this_month').then(setData).catch(() => setData(null));
  }, [token]);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Sales Trends</h1>
      <Card>
        <CardHeader><CardTitle>Revenue Trend</CardTitle></CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data?.revenue_trend || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line dataKey="value" type="monotone" stroke="#2563eb" strokeWidth={2.5} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

