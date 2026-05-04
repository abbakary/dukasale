'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/lib/stores/auth-store';
import { getAdminSubscriptionBillingHistoryApi } from '@/lib/api/admin-system';

export default function BillingHistoryPage() {
  const { token } = useAuthStore();
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    if (!token) return;
    getAdminSubscriptionBillingHistoryApi(token, 200).then(setRows).catch(() => setRows([]));
  }, [token]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Billing History</h1>
        <p className="text-muted-foreground">Latest subscription billing records from backend.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Billing Records ({rows.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {rows.map((r, idx) => (
            <div key={idx} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">{r.company_name}</p>
                <p className="text-xs text-muted-foreground">{r.plan} - {new Date(r.billing_date).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={r.status === 'paid' ? 'default' : 'secondary'}>{r.status}</Badge>
                <span className="text-sm font-semibold">TSh {Number(r.amount || 0).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

