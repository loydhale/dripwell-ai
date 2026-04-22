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

export type UserRole = 'super_user' | 'provider' | 'system_admin';

export interface TenantConfig {
  id: TenantId;
  name: string;
  state: string;
  medicalDirector: string;
  createdAt: Date;
}
