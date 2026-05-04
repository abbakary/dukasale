import { apiFetch } from "./client";

export interface AdminAnalyticsOverview {
  period: string;
  stats: {
    total_revenue: number;
    total_transactions: number;
    total_companies: number;
    active_companies: number;
    total_users: number;
    active_users: number;
  };
  subscription_distribution: Array<{ plan: string; count: number; percentage: number }>;
  revenue_trend: Array<{ month: string; value: number }>;
  signups_trend: Array<{ month: string; value: number }>;
  transaction_trend: Array<{ month: string; value: number }>;
  top_companies: Array<{
    company_id: string;
    name: string;
    types: string[];
    revenue: number;
    transactions: number;
  }>;
}

export function getAdminAnalyticsOverviewApi(token: string, period: string) {
  return apiFetch<AdminAnalyticsOverview>(`/admin/analytics/overview?period=${encodeURIComponent(period)}`, { token });
}

