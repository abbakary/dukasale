import { apiFetch } from "./client";

export interface Advertisement {
  id: string;
  title: string;
  content: string;
  image_url?: string;
  media_type: string;
  link_url?: string;
  target: string;
  placements: string[];
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
}

export async function listAdsApi(token: string) {
  return apiFetch<Advertisement[]>("/admin/ads", { token });
}

export async function createAdApi(payload: Omit<Advertisement, "id" | "created_at">, token: string) {
  return apiFetch<Advertisement>("/admin/ads", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export async function createAdvertisement(token: string, payload: Omit<Advertisement, "id" | "created_at">) {
  return createAdApi(payload, token);
}

export async function uploadAdImage(token: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  
  // Note: apiFetch usually assumes JSON, so we might need a custom fetch or to adjust apiFetch for FormData
  // For now, we will do a direct fetch since it's multipart/form-data
  const { getApiBaseUrl } = await import("./client");
  const response = await fetch(`${getApiBaseUrl()}/admin/ads/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: formData
  });
  
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to upload file");
  }
  
  return response.json() as Promise<{ image_url: string; media_type: 'image' | 'video' }>;
}

export async function deleteAdApi(adId: string, token: string) {
  return apiFetch<{ success: boolean }>(`/admin/ads/${adId}`, {
    method: "DELETE",
    token,
  });
}

export async function updateAdApi(adId: string, payload: Partial<Omit<Advertisement, "id" | "created_at">>, token: string) {
  return apiFetch<Advertisement>(`/admin/ads/${adId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(payload),
  });
}

export async function listTenantAdsApi(token: string, placement: string) {
  return apiFetch<Advertisement[]>(`/tenant/ads?placement=${encodeURIComponent(placement)}`, { token });
}

export async function getAdAnalyticsApi(token: string) {
  return apiFetch<{
    summary: Record<string, number>;
    status_breakdown: Record<string, number>;
    target_breakdown: Array<{ target: string; count: number }>;
    placement_breakdown: Array<{ placement: string; count: number }>;
    timeline: Array<{ label: string; count: number; active: number }>;
    ads: Advertisement[];
  }>("/admin/ads/analytics", { token });
}
