'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/lib/stores/auth-store';
import { getAdminAnalyticsOverviewApi } from '@/lib/api/admin-analytics';

export default function AdminReportsPage() {
  const { token } = useAuthStore();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!token) return;
    getAdminAnalyticsOverviewApi(token, 'this_month').then(setData).catch(() => setData(null));
  }, [token]);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Platform Reports</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Revenue</CardTitle></CardHeader><CardContent className="text-2xl font-bold">TSh {Number(data?.stats?.total_revenue || 0).toLocaleString()}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Transactions</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{Number(data?.stats?.total_transactions || 0).toLocaleString()}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Active Users</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{Number(data?.stats?.active_users || 0).toLocaleString()}</CardContent></Card>
      </div>
    </div>
  );
}

