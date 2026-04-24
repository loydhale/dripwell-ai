export type TenantId = string & { __brand: 'TenantId' };

export function makeTenantId(raw: string): TenantId {
  return raw as TenantId;
}

export type AssessmentId = string & { __brand: 'AssessmentId' };

export function makeAssessmentId(raw: string): AssessmentId {
  return raw as AssessmentId;
}

export type ProviderId = string & { __brand: 'ProviderId' };

export function makeProviderId(raw: string): ProviderId {
  return raw as ProviderId;
}

export type UserId = string & { __brand: 'UserId' };

export function makeUserId(raw: string): UserId {
  return raw as UserId;
}

export type LocationId = string & { __brand: 'LocationId' };

export function makeLocationId(raw: string): LocationId {
  return raw as LocationId;
}

export type CatalogItemId = string & { __brand: 'CatalogItemId' };

export function makeCatalogItemId(raw: string): CatalogItemId {
  return raw as CatalogItemId;
}

export type IngredientId = string & { __brand: 'IngredientId' };

export function makeIngredientId(raw: string): IngredientId {
  return raw as IngredientId;
}

export type ClinicalPatternId = string & { __brand: 'ClinicalPatternId' };

export function makeClinicalPatternId(raw: string): ClinicalPatternId {
  return raw as ClinicalPatternId;
}

export type PhotoCaptureId = string & { __brand: 'PhotoCaptureId' };

export function makePhotoCaptureId(raw: string): PhotoCaptureId {
  return raw as PhotoCaptureId;
}

export type RecommendationId = string & { __brand: 'RecommendationId' };

export function makeRecommendationId(raw: string): RecommendationId {
  return raw as RecommendationId;
}

export type SafetyFlagId = string & { __brand: 'SafetyFlagId' };

export function makeSafetyFlagId(raw: string): SafetyFlagId {
  return raw as SafetyFlagId;
}

export type OverrideId = string & { __brand: 'OverrideId' };

export function makeOverrideId(raw: string): OverrideId {
  return raw as OverrideId;
}

export type FeedbackId = string & { __brand: 'FeedbackId' };

export function makeFeedbackId(raw: string): FeedbackId {
  return raw as FeedbackId;
}

export type UserRole = 'super_user' | 'provider' | 'system_admin';

export interface TenantConfig {
  id: TenantId;
  name: string;
  slug: string;
  state: string;
  medicalDirector: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
