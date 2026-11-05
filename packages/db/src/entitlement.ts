import { prisma, Role } from './index';
import { Prisma } from '@prisma/client';

export type EntitlementFeature =
  | 'AI_GENERATION'
  | 'BLOG_PUBLICATION'
  | 'WORKFLOW_EXECUTION'
  | 'SHIELD_SCAN'
  | 'CLOUD_OPTIMIZATION'
  | 'NDPR_REPORT'
  | 'API_CALLS';

export interface PlanEntitlements {
  planId: string;
  planName: string;
  planSlug: string;
  subscriptionStatus: string;
  features: Record<string, any>;
  isActive: boolean;
  canUseFeature: (feature: EntitlementFeature) => boolean;
}

/**
 * Resolves the active subscription and plan entitlements for an organization.
 * Returns null if no active subscription exists.
 */
export async function getOrgEntitlements(
  organizationId: string
): Promise<PlanEntitlements | null> {
  const subscription = await prisma.subscription.findFirst({
    where: {
      organizationId,
      status: 'ACTIVE'
    },
    include: {
      plan: true
    }
  });

  if (!subscription) {
    return null;
  }

  const features = (subscription.plan.features as Record<string, any> | null) || {};

  return {
    planId: subscription.planId,
    planName: subscription.plan.name,
    planSlug: subscription.plan.slug,
    subscriptionStatus: subscription.status,
    features,
    isActive: subscription.status === 'ACTIVE',
    canUseFeature: (feature: EntitlementFeature) => {
      const featureConfig = features[feature];
      if (!featureConfig) return false;
      if (typeof featureConfig === 'boolean') return featureConfig;
      if (typeof featureConfig === 'object' && featureConfig.enabled !== undefined) {
        return featureConfig.enabled;
      }
      return true;
    }
  };
}

/**
 * Checks whether an organization is entitled to use a given feature.
 * Throws a descriptive error if not entitled.
 */
export async function enforceEntitlement(
  organizationId: string,
  feature: EntitlementFeature
): Promise<PlanEntitlements> {
  const entitlements = await getOrgEntitlements(organizationId);

  if (!entitlements) {
    throw new Error(
      `EntitlementDenied: No active subscription found for organization. Required feature: ${feature}`
    );
  }

  if (!entitlements.isActive) {
    throw new Error(
      `EntitlementDenied: Subscription is not active (status: ${entitlements.subscriptionStatus}). Required feature: ${feature}`
    );
  }

  if (!entitlements.canUseFeature(feature)) {
    throw new Error(
      `EntitlementDenied: Plan "${entitlements.planName}" does not include feature "${feature}". Upgrade your subscription to enable this feature.`
    );
  }

  return entitlements;
}

/**
 * Records a usage event for an organization, optionally linked to a subscription.
 */
export async function recordUsage(params: {
  organizationId: string;
  eventType: string;
  subscriptionId?: string;
  userId?: string;
  jobId?: string;
  tokensUsed?: number;
  storageBytes?: number;
  generationMs?: number;
  jobsExecuted?: number;
  rawPayload?: Record<string, unknown>;
}) {
  await prisma.usageEvent.create({
    data: {
      organizationId: params.organizationId,
      subscriptionId: params.subscriptionId,
      userId: params.userId,
      jobId: params.jobId,
      eventType: params.eventType,
      tokensUsed: params.tokensUsed ?? 0,
      storageBytes: params.storageBytes ?? 0,
      generationMs: params.generationMs ?? 0,
      jobsExecuted: params.jobsExecuted ?? 1,
      rawPayload: (params.rawPayload ?? undefined) as Prisma.InputJsonValue | undefined,
    }
  });
}

/**
 * Increments a usage record metric for a subscription.
 */
export async function incrementUsageRecord(
  subscriptionId: string,
  metric: string,
  quantity = 1
) {
  const existing = await prisma.usageRecord.findFirst({
    where: { subscriptionId, metric }
  });

  if (existing) {
    await prisma.usageRecord.update({
      where: { id: existing.id },
      data: { quantity: existing.quantity + quantity }
    });
  } else {
    await prisma.usageRecord.create({
      data: {
        subscriptionId,
        metric,
        quantity
      }
    });
  }
}
