'use client';

import { useEffect, useState } from 'react';
import { Shield, Mail } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/lib/stores/auth-store';
import { listAdminUsersApi, type AdminUser } from '@/lib/api/admin-users';

export default function AdminOnlyUsersPage() {
  const { token } = useAuthStore();
  const [admins, setAdmins] = useState<AdminUser[]>([]);

  useEffect(() => {
    if (!token) return;
    listAdminUsersApi(token).then((rows) => setAdmins(rows.filter((u) => u.role === 'admin'))).catch(() => setAdmins([]));
  }, [token]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Users</h1>
        <p className="text-muted-foreground">Platform/company administrators across all shops.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Total Admins: {admins.length}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {admins.map((admin) => (
            <div key={admin.id} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">{admin.name}</p>
                <p className="text-xs text-muted-foreground">{admin.company}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="capitalize">{admin.status}</Badge>
                <a href={`mailto:${admin.email}`} className="text-muted-foreground hover:text-foreground"><Mail className="size-4" /></a>
                <Shield className="size-4 text-purple-600" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

