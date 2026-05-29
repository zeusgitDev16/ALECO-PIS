import { getPosterJobStatus } from '../api/interruptionsApi';

/**
 * Shared utility for polling poster generation job status
 * @param {string} jobId - The job ID to poll
 * @param {Object} options - Configuration options
 * @param {Function} options.onProgress - Callback for progress updates (job, retryCount)
 * @param {Function} options.onComplete - Callback when job completes
 * @param {Function} options.onError - Callback when job fails
 * @param {Function} options.onTimeout - Callback when polling times out
 * @param {number} options.maxPollMs - Maximum polling duration in ms (default: 7 minutes)
 * @param {number} options.pollIntervalMs - Polling interval in ms (default: 2000ms)
 * @returns {Function} Cleanup function to cancel polling
 */
export function pollPosterJob(jobId, options = {}) {
  const {
    onProgress,
    onComplete,
    onError,
    onTimeout,
    maxPollMs = 7 * 60 * 1000, // 7 minutes
    pollIntervalMs = 2000,
  } = options;

  const startedAt = Date.now();
  let pollInterval = null;
  let isCancelled = false;

  const cleanup = () => {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    isCancelled = true;
  };

  pollInterval = setInterval(async () => {
    // Check timeout
    if (Date.now() - startedAt > maxPollMs) {
      cleanup();
      if (onTimeout) onTimeout();
      return;
    }

    // Check if cancelled
    if (isCancelled) {
      cleanup();
      return;
    }

    try {
      const statusR = await getPosterJobStatus(jobId);
      
      if (!statusR.success || !statusR.job) {
        cleanup();
        if (onError) onError('Failed to check job status');
        return;
      }

      const job = statusR.job;

      if (job.status === 'completed') {
        cleanup();
        if (onComplete) onComplete(job);
      } else if (job.status === 'failed') {
        cleanup();
        if (onError) onError(job.error || 'Poster generation failed');
      } else if (job.status === 'processing' && job.retryCount > 0) {
        if (onProgress) onProgress(job, job.retryCount);
      }
      // Still pending or processing - continue polling
    } catch (error) {
      cleanup();
      if (onError) onError(error.message || 'Network error');
    }
  }, pollIntervalMs);

  return cleanup;
}
