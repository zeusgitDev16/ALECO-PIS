/**
 * In-Memory Job Queue for Poster Generation
 * Optimized for e2-micro with concurrency limit of 1
 * Supports retry logic and job status tracking
 */

const MAX_CONCURRENT = 1;
const MAX_RETRIES = 3;
const JOB_RETENTION_MS = 60 * 60 * 1000; // 1 hour
// Hard timeout for a single executor call (one capture attempt + DB updates).
// Capture itself has a 90s internal timeout; allow some headroom for DB / Cloudinary.
const EXECUTOR_TIMEOUT_MS = 3 * 60 * 1000; // 3 min
// Special id used by auto-transition batch jobs (multiple advisories); never deduped.
const BATCH_JOB_ID = 0;

/**
 * @typedef {'pending'|'processing'|'completed'|'failed'} JobStatus
 * @typedef {'create'|'update'|'manual'} JobType
 * 
 * @typedef {Object} PosterJob
 * @property {string} id
 * @property {number} interruptionId
 * @property {JobType} type
 * @property {JobStatus} status
 * @property {number} retryCount
 * @property {string|null} result
 * @property {string|null} error
 * @property {number} createdAt
 * @property {number|null} startedAt
 * @property {number|null} completedAt
 */

class PosterJobQueue {
  constructor() {
    this.queue = [];
    this.active = 0;
    this.jobs = new Map(); // jobId -> PosterJob
    this.processing = false;
    this.cleanupInterval = null;
    
    // Start periodic cleanup
    this.startCleanup();
  }

  /**
   * Generate unique job ID
   * @returns {string}
   */
  generateJobId() {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add a job to the queue.
   *
   * Deduplication: if a pending (not yet processing) job already exists for the
   * same interruptionId (and id !== BATCH_JOB_ID, and the new job is not manual),
   * the queued entry's executor is REPLACED with the new one so the latest
   * mutation state is captured. This collapses rapid successive edits into a
   * single capture without blocking concurrent edits.
   *
   * Manual jobs (from /poster-capture or /poster-stub) are always enqueued fresh
   * so admins get explicit feedback per click.
   *
   * @param {number} interruptionId
   * @param {JobType|string} type
   * @param {Function} executor - Async function to execute the job
   * @returns {string} jobId
   */
  async add(interruptionId, type, executor) {
    const canDedup =
      Number.isFinite(interruptionId) &&
      interruptionId !== BATCH_JOB_ID &&
      type !== 'manual';

    if (canDedup) {
      // Find a still-pending job for this id and swap its executor.
      for (const queued of this.queue) {
        const existing = this.jobs.get(queued.jobId);
        if (
          existing &&
          existing.status === 'pending' &&
          existing.interruptionId === interruptionId
        ) {
          queued.executor = executor;
          console.log(
            `[posterQueue] dedup: replaced executor for pending job ${existing.id} (id=${interruptionId} type=${existing.type} -> ${type})`
          );
          // Keep the original type label for traceability but track the latest trigger too
          existing.type = type;
          return existing.id;
        }
      }
    }

    const jobId = this.generateJobId();
    const job = {
      id: jobId,
      interruptionId,
      type,
      status: 'pending',
      retryCount: 0,
      result: null,
      error: null,
      createdAt: Date.now(),
      startedAt: null,
      completedAt: null,
    };

    this.jobs.set(jobId, job);
    this.queue.push({ jobId, executor });

    // Start processing if not already running
    this.process();

    return jobId;
  }

  /**
   * Get job status
   * @param {string} jobId
   * @returns {PosterJob|null}
   */
  getStatus(jobId) {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Process queued jobs
   */
  async process() {
    if (this.processing || this.active >= MAX_CONCURRENT) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0 && this.active < MAX_CONCURRENT) {
      const { jobId, executor } = this.queue.shift();
      const job = this.jobs.get(jobId);

      if (!job || job.status !== 'pending') {
        continue;
      }

      this.active++;
      job.status = 'processing';
      job.startedAt = Date.now();

      // Execute job with retry logic
      this.executeJob(job, executor).catch((err) => {
        console.error(`[posterQueue] Job ${jobId} execution error:`, err);
      });
    }

    this.processing = false;
  }

  /**
   * Run an async function with a hard timeout. Rejects if the function does not
   * settle within `timeoutMs`. Used to keep one hung executor from blocking the queue.
   * @param {Function} fn
   * @param {number} timeoutMs
   * @returns {Promise<any>}
   */
  runWithTimeout(fn, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Job executor exceeded timeout of ${timeoutMs}ms`));
      }, timeoutMs);
      Promise.resolve()
        .then(() => fn())
        .then(
          (value) => {
            clearTimeout(timer);
            resolve(value);
          },
          (err) => {
            clearTimeout(timer);
            reject(err);
          }
        );
    });
  }

  /**
   * Execute a single job with retry logic
   * @param {PosterJob} job
   * @param {Function} executor
   */
  async executeJob(job, executor) {
    let lastError = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await this.runWithTimeout(executor, EXECUTOR_TIMEOUT_MS);

        // Success
        job.status = 'completed';
        job.result = result;
        job.completedAt = Date.now();
        this.active--;

        console.log(`[posterQueue] Job ${job.id} completed successfully`);
        this.process(); // Process next job
        return;
      } catch (err) {
        lastError = err;
        job.retryCount = attempt + 1;
        
        console.warn(`[posterQueue] Job ${job.id} attempt ${attempt + 1} failed:`, err?.message || err);

        // Don't retry on last attempt
        if (attempt < MAX_RETRIES) {
          // Exponential backoff: 1s, 2s, 4s
          const backoffMs = Math.pow(2, attempt) * 1000;
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }
      }
    }

    // All retries failed
    job.status = 'failed';
    job.error = lastError?.message || 'Unknown error';
    job.completedAt = Date.now();
    this.active--;
    
    console.error(`[posterQueue] Job ${job.id} failed after ${MAX_RETRIES} retries`);
    this.process(); // Process next job
  }

  /**
   * Start periodic cleanup of old jobs
   */
  startCleanup() {
    if (this.cleanupInterval) {
      return;
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000); // Run every 5 minutes
  }

  /**
   * Remove completed/failed jobs older than retention period
   */
  cleanup() {
    const now = Date.now();
    const toDelete = [];

    for (const [jobId, job] of this.jobs.entries()) {
      if (
        (job.status === 'completed' || job.status === 'failed') &&
        job.completedAt &&
        now - job.completedAt > JOB_RETENTION_MS
      ) {
        toDelete.push(jobId);
      }
    }

    for (const jobId of toDelete) {
      this.jobs.delete(jobId);
      console.log(`[posterQueue] Cleaned up old job ${jobId}`);
    }
  }

  /**
   * Get queue statistics
   * @returns {Object}
   */
  getStats() {
    const stats = {
      total: this.jobs.size,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      active: this.active,
      queueLength: this.queue.length,
    };

    for (const job of this.jobs.values()) {
      stats[job.status]++;
    }

    return stats;
  }

  /**
   * Stop cleanup interval (call on server shutdown)
   */
  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Singleton instance
const posterJobQueue = new PosterJobQueue();

export default posterJobQueue;
export { PosterJobQueue };
