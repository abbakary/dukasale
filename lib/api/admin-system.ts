import { apiFetch } from "./client";

export function getAdminSystemOverviewApi(token: string) {
  return apiFetch<any>("/admin/system/overview", { token });
}

export function getAdminSystemLogsApi(token: string, limit = 100) {
  return apiFetch<any[]>(`/admin/system/logs?limit=${limit}`, { token });
}

export function getAdminSystemNotificationsApi(token: string) {
  return apiFetch<any[]>("/admin/system/notifications", { token });
}

export function getAdminSettingsApi(token: string) {
  return apiFetch<any>("/admin/settings", { token });
}

export function updateAdminSettingsApi(token: string, payload: any) {
  return apiFetch<any>("/admin/settings", {
    method: "PATCH",
    token,
    body: JSON.stringify(payload),
  });
}

export function getAdminUserActivityApi(token: string, limit = 100) {
  return apiFetch<any[]>(`/admin/users/activity?limit=${limit}`, { token });
}

export function getAdminSubscriptionRevenueApi(token: string, period = "this_month") {
  return apiFetch<any>(`/admin/subscriptions/revenue?period=${encodeURIComponent(period)}`, { token });
}

export function getAdminSubscriptionBillingHistoryApi(token: string, limit = 100) {
  return apiFetch<any[]>(`/admin/subscriptions/billing-history?limit=${limit}`, { token });
}

