'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Megaphone } from 'lucide-react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { listTenantAdsApi, type Advertisement } from '@/lib/api/admin-ads';

export function TenantAdBanner({ placement = 'dashboard' }: { placement?: string }) {
  const { token } = useAuthStore();
  const [ads, setAds] = useState<Advertisement[]>([]);

  useEffect(() => {
    if (!token) return;
    listTenantAdsApi(token, placement).then(setAds).catch(() => setAds([]));
  }, [token, placement]);

  const visible = useMemo(() => ads.slice(0, 2), [ads]);
  if (!visible.length) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {visible.map((ad) => (
        <div key={ad.id} className="relative overflow-hidden rounded-2xl border bg-gradient-to-r from-indigo-600 via-violet-600 to-blue-600 p-5 text-white shadow-sm">
          <div className="absolute -right-10 -top-10 size-32 rounded-full bg-white/20 blur-3xl" />
          <div className="relative">
            <div className="mb-2 inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/15 px-2 py-1 text-[11px] font-bold uppercase tracking-wider">
              <Megaphone className="size-3" />
              Sponsored
            </div>
            <p className="text-lg font-bold leading-tight">{ad.title}</p>
            <p className="mt-1 line-clamp-2 text-sm text-white/90">{ad.content}</p>
            {ad.link_url ? (
              <Link href={ad.link_url} target="_blank" className="mt-3 inline-block text-xs font-semibold underline underline-offset-4">
                Learn more
              </Link>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

