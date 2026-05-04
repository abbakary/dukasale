'use client';

import { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/lib/stores/auth-store';
import { getAdminUserActivityApi } from '@/lib/api/admin-system';

export default function AdminUserActivityPage() {
  const { token } = useAuthStore();
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    if (!token) return;
    getAdminUserActivityApi(token, 150).then(setRows).catch(() => setRows([]));
  }, [token]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">User Activity Log</h1>
        <p className="text-muted-foreground">Recent account updates and user status changes.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Recent Activity ({rows.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {rows.map((row) => (
            <div key={row.user_id + row.updated_at} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">{row.user_name} ({row.email})</p>
                <p className="text-xs text-muted-foreground">Role: {row.role} - Status: {row.status}</p>
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Activity className="size-3.5" />
                {row.updated_at ? new Date(row.updated_at).toLocaleString() : '-'}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

