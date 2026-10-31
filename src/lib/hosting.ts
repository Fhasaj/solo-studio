/*
 * @name: Hosting fees
 * @description: A job's monthly hosting fee is its running costs (servers, domains, email, backups) plus a markup.
 * Shared by the projects API, which stores the result, and the admin job page, which shows it live.
 * */

import type { HostingCost } from './query/clients.query';

// Yearly costs (like a domain) count as a twelfth per month
export function monthlyCost(costs: HostingCost[]) {
  return costs.reduce((sum, cost) => sum + (cost.period === 'year' ? cost.amount / 12 : cost.amount), 0);
}

// Fee in pence, rounded to the nearest penny
export function hostingFee(costs: HostingCost[], markupPercent: number) {
  return Math.round(monthlyCost(costs) * (1 + markupPercent / 100));
}
