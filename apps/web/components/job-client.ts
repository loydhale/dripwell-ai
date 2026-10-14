'use client';

import { apiRequest } from './clinic-context';

export async function waitForJob(jobId: string) {
  for (let attempt = 0; attempt < 90; attempt++) {
    const job = await apiRequest<{
      status: string;
      result?: Record<string, unknown>;
      errorCode?: string;
      error?: string;
    }>(`/api/jobs/${jobId}`);
    if (job.status === 'complete') return job.result || {};
    if (job.status === 'cancelled' || job.status === 'canceled')
      throw new Error(
        'Processing was canceled after the recording was discarded. Review the saved visit before proceeding.',
      );
    if (job.status === 'failed')
      throw new Error(
        job.error ||
          `Processing failed (${job.errorCode || 'provider error'}). Retry the saved recording.`,
      );
    await new Promise((resolve) => window.setTimeout(resolve, 2000));
  }
  throw new Error(
    'Processing is taking longer than expected. The job is saved. Refresh the visit to check its progress.',
  );
}
