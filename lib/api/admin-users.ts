import { apiFetch } from "./client";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  company: string;
  role: string;
  status: string;
  lastLogin: string | null;
  plan: string;
}

export async function listAdminUsersApi(token: string) {
  const [users, companies] = await Promise.all([
    apiFetch<any[]>("/admin/users", { token }),
    apiFetch<any[]>("/admin/companies", { token }),
  ]);
  const companyById = new Map(companies.map((c) => [c.id, c]));
  return users.map((u) => {
    const company = companyById.get(u.company_id);
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      company: company?.name || "N/A",
      role: u.role,
      status: u.is_active ? "active" : "suspended",
      lastLogin: u.last_login || null,
      plan: company?.subscription_plan || "free",
    } satisfies AdminUser;
  });
}

export async function toggleAdminUserStatusApi(userId: string, token: string) {
  return apiFetch<{ id: string; status: string }>(`/admin/users/${userId}/toggle-status`, {
    method: "PATCH",
    token,
  });
}
