/**
 * In-Memory Job Queue for Poster Generation
 * Optimized for e2-micro with concurrency limit of 1
 * Supports retry logic and job status tracking
 */

const MAX_CONCURRENT = 1;
const MAX_RETRIES = 3;
const JOB_RETENTION_MS = 60 * 60 * 1000; // 1 hour

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
   * Add a job to the queue
   * @param {number} interruptionId
   * @param {JobType} type
   * @param {Function} executor - Async function to execute the job
   * @returns {string} jobId
   */
  async add(interruptionId, type, executor) {
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
   * Execute a single job with retry logic
   * @param {PosterJob} job
   * @param {Function} executor
   */
  async executeJob(job, executor) {
    let lastError = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await executor();
        
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
