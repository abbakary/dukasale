'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/lib/stores/auth-store';
import { getAdminSystemOverviewApi } from '@/lib/api/admin-system';

export default function AdminSystemOverviewPage() {
  const { token } = useAuthStore();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!token) return;
    getAdminSystemOverviewApi(token).then(setData).catch(() => setData(null));
  }, [token]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">System Overview</h1>
        <p className="text-muted-foreground">Live backend system status and 24h activity.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Health</CardTitle></CardHeader><CardContent className="text-xl font-bold capitalize">{data?.health || 'unknown'}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">DB Status</CardTitle></CardHeader><CardContent className="text-xl font-bold capitalize">{data?.database_status || 'unknown'}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">24h Transactions</CardTitle></CardHeader><CardContent className="text-xl font-bold">{data?.last_24h?.transactions || 0}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">24h New Users</CardTitle></CardHeader><CardContent className="text-xl font-bold">{data?.last_24h?.new_users || 0}</CardContent></Card>
      </div>
    </div>
  );
}

