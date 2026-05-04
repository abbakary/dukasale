'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/lib/stores/auth-store';
import { getAdminSystemNotificationsApi } from '@/lib/api/admin-system';

export default function AdminSystemNotificationsPage() {
  const { token } = useAuthStore();
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    if (!token) return;
    getAdminSystemNotificationsApi(token).then(setRows).catch(() => setRows([]));
  }, [token]);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">System Notifications</h1>
      <Card>
        <CardHeader><CardTitle>Notifications ({rows.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {rows.map((n, idx) => (
            <div key={idx} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">{n.title}</p>
                <p className="text-xs text-muted-foreground">{n.message}</p>
              </div>
              <Badge variant={n.severity === 'warning' ? 'secondary' : 'default'}>{n.severity}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

