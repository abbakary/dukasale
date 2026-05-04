'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/lib/stores/auth-store';
import { getAdminSystemLogsApi } from '@/lib/api/admin-system';

export default function AdminSystemLogsPage() {
  const { token } = useAuthStore();
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    if (!token) return;
    getAdminSystemLogsApi(token, 150).then(setLogs).catch(() => setLogs([]));
  }, [token]);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">System Logs</h1>
      <Card>
        <CardHeader><CardTitle>Latest Logs ({logs.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {logs.map((log, idx) => (
            <div key={idx} className="rounded-lg border p-3">
              <p className="text-sm font-medium">{log.message}</p>
              <p className="text-xs text-muted-foreground">{log.source} - {new Date(log.timestamp).toLocaleString()}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

