'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  ActualCare,
  ClinicConfiguration,
  ConsultationStage,
  ConsultationSummary,
  InitialRecommendation,
  QuestionState,
  WellnessPlan,
} from '@dripwell/shared/v2';
import type { MembershipMetrics } from '../lib/membership-metrics';

export interface ConfigurationVersion {
  id: string;
  version: number;
  revision: number;
  status: string;
  configuration: ClinicConfiguration;
  createdAt: string;
  approvedAt?: string | null;
  activatedAt?: string | null;
  source?: string;
  tests?: {
    id: string;
    testedAt: string;
    summary: ConsultationSummary;
    initial: InitialRecommendation;
    approvedByOwner: boolean;
    notes: string;
  }[];
}
export interface ConsultationView {
  id: string;
  reference: string;
  stage: ConsultationStage;
  version: number;
  locationId: string;
  providerId: string;
  providerName?: string;
  isTest: boolean;
  configurationVersionId: string;
  configuration?: ClinicConfiguration;
  consentAt?: string | null;
  consentDeclined: boolean;
  summary: ConsultationSummary;
  transcript: { id: string; sequence: number; text: string; receivedAt: string }[];
  initialRecommendation: InitialRecommendation | null;
  initialRevision: number;
  clinicalApprovedVersion: number | null;
  clinicalApprovedAt: string | null;
  actualCare: ActualCare | null;
  careOutcome: string;
  wellnessPlan: WellnessPlan | null;
  wellnessRevision: number;
  wellnessApprovedVersion: number | null;
  wellnessApprovedAt: string | null;
  wellnessDecision: string | null;
  wellnessDecisionRevision: number | null;
  archivedAt: string | null;
  archiveReason: string | null;
  createdAt: string;
  updatedAt: string;
  questionStates?: QuestionState[];
  decisionNeedsReview?: boolean;
  adjustments?: AdjustmentView[];
  jobs?: {
    id: string;
    kind: string;
    status: string;
    errorCode: string | null;
    result: Record<string, unknown> | null;
  }[];
}
export interface AdjustmentView {
  id: string;
  consultationId: string;
  field?: string;
  artifactKind?: string;
  kind?: string;
  before: unknown;
  after: unknown;
  reason: string;
  reasonNote?: string;
  note?: string;
  actorName?: string;
  userId?: string;
  actorId?: string;
  createdAt: string;
}
export interface NotificationView {
  id: string;
  consultationId?: string | null;
  reference?: string;
  type: string;
  message?: string;
  title?: string;
  readAt?: string | null;
  createdAt: string;
  isRead?: boolean;
}
export interface StaffView {
  id: string;
  name: string;
  email: string;
  role: string;
  canApproveClinical?: boolean;
  isActive: boolean;
}
export interface ClinicPayload {
  user: Pick<StaffView, 'id' | 'name' | 'email' | 'role' | 'canApproveClinical'>;
  clinic: { id: string; name: string; slug?: string };
  locations: { id: string; name: string }[];
  configuration: {
    draft: ConfigurationVersion | null;
    active: ConfigurationVersion | null;
    versions: ConfigurationVersion[];
  };
  consultations: ConsultationView[];
  consultationCount: number;
  consultationPagination: { nextCursor: string | null; pageSize: number };
  notifications: NotificationView[];
  metrics: MembershipMetrics & {
    from: string;
    to: string;
    denominator: number;
    consultations: number;
    careStarted: number;
    careNotStarted: number;
    carePending: number;
    wellnessAccepted: number;
    wellnessRejected: number;
    wellnessTbd: number;
    wellnessUndecided: number;
    adjustments: number;
    overdue: number;
    completionMedianHours: number | null;
  };
  improvements: {
    id: string;
    title: string;
    classification: string;
    configurationVersionId: string;
    status: string;
    evidence?: unknown;
    proposedPayload?: ClinicConfiguration;
    reviewNote?: string;
    tests?: ConfigurationVersion['tests'];
    createdAt: string;
  }[];
  trial: {
    used: number;
    remaining: number;
    limit: number;
    endsAt: string | null;
    status: string;
    daysRemaining: number;
    canStart: boolean;
  } | null;
  adjustments: (AdjustmentView & {
    consultation?: {
      reference: string;
      summary: ConsultationSummary;
      actualCare: ActualCare | null;
      wellnessDecision: string | null;
    };
  })[];
  referral?: unknown;
  staff: StaffView[];
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly code: string | null,
  ) {
    super(message);
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...init });
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const error = new ApiRequestError(
      typeof payload.error === 'string'
        ? payload.error
        : typeof payload.message === 'string'
          ? payload.message
          : `Request failed (${response.status}).`,
      typeof payload.code === 'string' ? payload.code : null,
    );
    if (response.status === 401) window.location.assign('/login');
    throw error;
  }
  return payload as T;
}

export function postJson<T>(path: string, body: unknown) {
  return apiRequest<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

type ClinicFilters = {
  archived?: boolean;
  from?: string;
  to?: string;
  locationId?: string;
  search?: string;
  pageSize?: number;
};

interface ContextValue {
  data: ClinicPayload | null;
  loading: boolean;
  error: string;
  refresh: (filters?: ClinicFilters) => Promise<void>;
  loadMore: () => Promise<void>;
  pageError: string;
  locationId: string;
  selectLocation: (id: string) => Promise<void>;
  captureBusy: boolean;
  setCaptureBusy: (busy: boolean) => void;
  mutate: <T = Record<string, unknown>>(
    action: string,
    fields?: Record<string, unknown>,
  ) => Promise<T>;
}
const ClinicContext = createContext<ContextValue | null>(null);

export function ClinicProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<ClinicPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pageError, setPageError] = useState('');
  const [locationId, setLocationId] = useState('');
  const [captureBusy, setCaptureBusy] = useState(false);
  const query = useRef('');
  const requestId = useRef(0);
  const refresh = useCallback(
    async (filters?: ClinicFilters) => {
      if (filters) {
        const params = new URLSearchParams(query.current);
        for (const [key, value] of Object.entries(filters))
          if (value !== undefined) params.set(key, String(value));
        query.current = params.toString();
      }
      const thisRequest = ++requestId.current;
      setLoading(true);
      setPageError('');
      try {
        const result = await apiRequest<ClinicPayload>(
          `/api/clinic${query.current ? `?${query.current}` : ''}`,
        );
        if (thisRequest === requestId.current) {
          setData(result);
          setLocationId(
            (current) =>
              current ||
              new URLSearchParams(query.current).get('locationId') ||
              result.locations[0]?.id ||
              '',
          );
          setError('');
        }
      } catch (cause) {
        if (thisRequest === requestId.current)
          setError(cause instanceof Error ? cause.message : 'Unable to load clinic.');
      } finally {
        if (thisRequest === requestId.current) setLoading(false);
      }
    },
    [],
  );
  const loadMore = useCallback(async () => {
    const cursor = data?.consultationPagination.nextCursor;
    if (!cursor || loading) return;
    const params = new URLSearchParams(query.current);
    params.set('cursor', cursor);
    const thisRequest = ++requestId.current;
    setLoading(true);
    setPageError('');
    try {
      const result = await apiRequest<ClinicPayload>(`/api/clinic?${params}`);
      if (thisRequest === requestId.current) {
        setData(current => {
          if (!current) return result;
          const existingIds = new Set(current.consultations.map(item => item.id));
          return { ...result, consultations: [
            ...current.consultations,
            ...result.consultations.filter(item => !existingIds.has(item.id)),
          ] };
        });
      }
    } catch (cause) {
      if (thisRequest === requestId.current) {
        setPageError(cause instanceof Error ? cause.message : 'Unable to load more visits.');
      }
    } finally {
      if (thisRequest === requestId.current) setLoading(false);
    }
  }, [data, loading]);
  useEffect(() => {
    const selected = new URLSearchParams(window.location.search).get('locationId');
    if (selected) {
      query.current = new URLSearchParams({ locationId: selected }).toString();
      setLocationId(selected);
    }
    void refresh();
    if ('serviceWorker' in navigator)
      void navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, [refresh]);
  const mutate = useCallback(
    async <T,>(action: string, fields: Record<string, unknown> = {}) => {
      const result = await postJson<T>('/api/clinic', { action, ...fields });
      await refresh();
      return result;
    },
    [refresh],
  );
  const selectLocation = useCallback(
    async (id: string) => {
      setLocationId(id);
      setData(null);
      setLoading(true);
      const url = new URL(window.location.href);
      url.searchParams.set('locationId', id);
      window.history.replaceState(null, '', url);
      await refresh({ locationId: id });
    },
    [refresh],
  );
  return (
    <ClinicContext.Provider
      value={{
        data,
        loading,
        error,
        refresh,
        loadMore,
        pageError,
        mutate,
        locationId,
        selectLocation,
        captureBusy,
        setCaptureBusy,
      }}
    >
      {children}
    </ClinicContext.Provider>
  );
}

export function useClinic() {
  const value = useContext(ClinicContext);
  if (!value) throw new Error('ClinicProvider is required.');
  return value;
}

export function isOwner(role: string) {
  return ['SUPER_USER', 'super_user', 'OWNER'].includes(role);
}

export function locationHref(path: string, locationId: string) {
  return locationId
    ? `${path}${path.includes('?') ? '&' : '?'}locationId=${encodeURIComponent(locationId)}`
    : path;
}

export const stageLabels: Record<ConsultationStage, string> = {
  CONSULTATION_STARTED: 'Consultation started',
  INITIAL_RECOMMENDATIONS_GIVEN: 'Initial recommendations',
  WELLNESS_RECOMMENDATIONS_PRODUCED: 'Wellness plan produced',
  WELLNESS_RECOMMENDATIONS_ACCEPTED: 'Wellness accepted',
  WELLNESS_RECOMMENDATIONS_REJECTED: 'Wellness rejected',
  WELLNESS_RECOMMENDATION_TBD: 'Decision pending',
};

export const stageTones: Record<ConsultationStage, string> = {
  CONSULTATION_STARTED: 'blue',
  INITIAL_RECOMMENDATIONS_GIVEN: 'purple',
  WELLNESS_RECOMMENDATIONS_PRODUCED: 'teal',
  WELLNESS_RECOMMENDATIONS_ACCEPTED: 'green',
  WELLNESS_RECOMMENDATIONS_REJECTED: 'coral',
  WELLNESS_RECOMMENDATION_TBD: 'amber',
};
