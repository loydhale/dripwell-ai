import { actualCareSchema } from '@dripwell/shared/v2';

export type MembershipMetrics = {
  membershipEnrollments: number;
  membershipDeclines: number;
  membershipNotRecorded: number;
  membershipRecorded: number;
  /** Fraction of recorded outcomes, or null when no outcome is recorded. */
  membershipEnrollmentRate: number | null;
};

/** The caller supplies the complete server-selected consultation-visit cohort. */
export function membershipMetrics(outcomes: readonly { actualCare: unknown }[]): MembershipMetrics {
  let membershipEnrollments = 0;
  let membershipDeclines = 0;
  for (const outcome of outcomes) {
    const care = actualCareSchema.safeParse(outcome.actualCare);
    if (!care.success) continue;
    if (care.data.membershipEnrolled === true) membershipEnrollments++;
    if (care.data.membershipEnrolled === false) membershipDeclines++;
  }
  const membershipRecorded = membershipEnrollments + membershipDeclines;
  return {
    membershipEnrollments,
    membershipDeclines,
    membershipNotRecorded: outcomes.length - membershipRecorded,
    membershipRecorded,
    membershipEnrollmentRate: membershipRecorded ? membershipEnrollments / membershipRecorded : null,
  };
}
