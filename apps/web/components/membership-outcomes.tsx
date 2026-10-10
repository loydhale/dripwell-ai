import type { MembershipMetrics } from '../lib/membership-metrics';

const reportingDate = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric',
  hour: 'numeric', minute: '2-digit', second: '2-digit', timeZoneName: 'short',
});
const percentage = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 });

export function MembershipOutcomes({ metrics }: {
  metrics: MembershipMetrics & { denominator: number; from: string; to: string };
}) {
  return (
    <section className="panel" aria-label="Client membership outcomes">
      <div className="section-heading">
        <div>
          <h2>Client membership outcomes</h2>
          <p>Staff-confirmed clinic membership enrollment in this location.</p>
        </div>
      </div>
      <div className="stats-grid">
        <div className="stat-card">
          <span>Enrolled</span>
          <strong>{metrics.membershipEnrollments}<em>/{metrics.denominator}</em></strong>
          <small>Confirmed enrollments / selected consultations</small>
        </div>
        <div className="stat-card">
          <span>Did not enroll</span>
          <strong>{metrics.membershipDeclines}</strong>
          <small>Staff recorded no enrollment</small>
        </div>
        <div className="stat-card">
          <span>Not recorded</span>
          <strong>{metrics.membershipNotRecorded}</strong>
          <small>Missing or invalid membership outcomes</small>
        </div>
        <div className="stat-card">
          <span>Recorded-outcome enrollment rate</span>
          <strong>{metrics.membershipEnrollmentRate === null
            ? 'Not available' : percentage.format(metrics.membershipEnrollmentRate)}</strong>
          <small>{metrics.membershipRecorded > 0
            ? `${metrics.membershipEnrollments} enrolled of ${metrics.membershipRecorded} recorded outcomes; ${metrics.membershipNotRecorded} not recorded.`
            : `No membership outcomes recorded; ${metrics.membershipNotRecorded} not recorded.`}</small>
        </div>
      </div>
      <p className="board-help">
        Cohort: {metrics.denominator} consultation visits created from{' '}
        <time dateTime={metrics.from} title={metrics.from}>{reportingDate.format(new Date(metrics.from))}</time>{' '}
        (inclusive) to{' '}
        <time dateTime={metrics.to} title={metrics.to}>{reportingDate.format(new Date(metrics.to))}</time>{' '}
        (exclusive). Archived visits are included; setup tests are excluded. Board search and paging
        do not change these totals. Each visit counts separately, including repeat client visits.
      </p>
      <p className="board-help">
        Wellness acceptance and service purchases are separate outcomes. Staff-confirmed enrollment
        does not verify payment collection. DripWell account billing is separate.
      </p>
    </section>
  );
}
