import type { PortalLinkedAthleteBilling } from "@morphos/portal-api-client"

export { isDashboardEligibleCoachTeam } from "@morphos/portal-api-client"

export function isSubscriptionActive(status: string | null | undefined): boolean {
  const normalized = String(status ?? "").toLowerCase()
  return normalized === "active" || normalized === "trialing"
}

/** Billing display rule mirrored from Athlete Portal subscriptionPlans. */
export function isBillingPlanDisplayedAsActive(
  status: string | null | undefined,
  tier: string | null | undefined,
  subscriptionLive?: boolean | null,
): boolean {
  if (subscriptionLive === true) return true
  return !!(tier && isSubscriptionActive(status))
}

export function isLinkedAthleteSubscriptionActive(ward: PortalLinkedAthleteBilling): boolean {
  return isBillingPlanDisplayedAsActive(ward.status, ward.tier, ward.subscriptionLive)
}

export function isSelfAthleteSubscriptionActive(args: {
  athleteSub: { tier?: string | null; status?: string | null } | null | undefined
  billingManagedByGuardian: boolean
}): boolean {
  if (args.billingManagedByGuardian) return false
  const sub = args.athleteSub
  if (!sub) return false
  return isBillingPlanDisplayedAsActive(sub.status ?? null, sub.tier ?? null)
}
