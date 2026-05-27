/**
 * In-Memory Job Queue for Ticket Submissions
 * Optimized for e2-micro with concurrency limit of 5
 * Supports retry logic, job status tracking, priority queue, and wait time estimation
 */

const MAX_CONCURRENT = 5;
const MAX_RETRIES = 3;
const JOB_RETENTION_MS = 60 * 60 * 1000; // 1 hour

/**
 * @typedef {'pending'|'processing'|'completed'|'failed'} JobStatus
 * @typedef {'normal'|'urgent'} JobPriority
 * 
 * @typedef {Object} TicketJob
 * @property {string} id
 * @property {JobStatus} status
 * @property {JobPriority} priority
 * @property {number} retryCount
 * @property {string|null} ticketId
 * @property {string|null} error
 * @property {number} createdAt
 * @property {number|null} startedAt
 * @property {number|null} completedAt
 * @property {Object} submissionData
 * @property {number} queuePosition
 */

class TicketSubmissionQueue {
  constructor() {
    this.queue = []; // Array of { jobId, executor, priority }
    this.active = 0;
    this.jobs = new Map(); // jobId -> TicketJob
    this.processing = false;
    this.cleanupInterval = null;
    
    // Processing time tracking for wait time estimation
    this.processingTimes = []; // Array of recent processing times (ms)
    this.maxProcessingTimeSamples = 50;
    
    // Start periodic cleanup
    this.startCleanup();
  }

  /**
   * Generate unique job ID
   * @returns {string}
   */
  generateJobId() {
    return `ticket_job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add a job to the queue with priority
   * @param {Object} submissionData
   * @param {Function} executor - Async function to execute the job
   * @param {boolean} isUrgent - Whether this is an urgent ticket
   * @returns {string} jobId
   */
  async add(submissionData, executor, isUrgent = false) {
    const jobId = this.generateJobId();
    const priority = isUrgent ? 'urgent' : 'normal';
    const job = {
      id: jobId,
      status: 'pending',
      priority,
      retryCount: 0,
      ticketId: null,
      error: null,
      createdAt: Date.now(),
      startedAt: null,
      completedAt: null,
      submissionData,
      queuePosition: 0,
    };

    this.jobs.set(jobId, job);
    
    // Add to queue with priority (urgent jobs go to front)
    if (priority === 'urgent') {
      // Find the last urgent job and insert after it
      let insertIndex = 0;
      for (let i = 0; i < this.queue.length; i++) {
        if (this.queue[i].priority !== 'urgent') {
          insertIndex = i;
          break;
        }
        insertIndex = i + 1;
      }
      this.queue.splice(insertIndex, 0, { jobId, executor, priority });
    } else {
      this.queue.push({ jobId, executor, priority });
    }
    
    // Update queue positions
    this.updateQueuePositions();
    
    // Start processing if not already running
    this.process();
    
    return jobId;
  }

  /**
   * Update queue positions for all pending jobs
   */
  updateQueuePositions() {
    let position = 1;
    for (const item of this.queue) {
      const job = this.jobs.get(item.jobId);
      if (job && job.status === 'pending') {
        job.queuePosition = position;
        position++;
      }
    }
  }

  /**
   * Get job status with queue position and estimated wait time
   * @param {string} jobId
   * @returns {TicketJob|null}
   */
  getStatus(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return null;

    // Calculate estimated wait time
    let estimatedWaitSeconds = 0;
    if (job.status === 'pending') {
      const avgProcessingTime = this.getAverageProcessingTime();
      const jobsAhead = job.queuePosition - 1;
      const concurrentSlots = Math.max(1, MAX_CONCURRENT - this.active);
      estimatedWaitSeconds = Math.ceil((jobsAhead / concurrentSlots) * (avgProcessingTime / 1000));
    }

    return {
      ...job,
      queuePosition: job.queuePosition,
      estimatedWaitSeconds,
    };
  }

  /**
   * Get average processing time from recent samples
   * @returns {number} Average processing time in milliseconds
   */
  getAverageProcessingTime() {
    if (this.processingTimes.length === 0) {
      return 2000; // Default: 2 seconds
    }
    const sum = this.processingTimes.reduce((a, b) => a + b, 0);
    return Math.floor(sum / this.processingTimes.length);
  }

  /**
   * Record processing time for a completed job
   * @param {number} processingTimeMs
   */
  recordProcessingTime(processingTimeMs) {
    this.processingTimes.push(processingTimeMs);
    if (this.processingTimes.length > this.maxProcessingTimeSamples) {
      this.processingTimes.shift(); // Remove oldest sample
    }
  }

  /**
   * Process queued jobs with priority (urgent first)
   */
  async process() {
    if (this.processing || this.active >= MAX_CONCURRENT) {
      return;
    }

    this.processing = true;

    // Sort queue by priority (urgent first, then by creation time)
    this.queue.sort((a, b) => {
      if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
      if (a.priority !== 'urgent' && b.priority === 'urgent') return 1;
      const jobA = this.jobs.get(a.jobId);
      const jobB = this.jobs.get(b.jobId);
      return (jobA?.createdAt || 0) - (jobB?.createdAt || 0);
    });

    while (this.queue.length > 0 && this.active < MAX_CONCURRENT) {
      const { jobId, executor } = this.queue.shift();
      const job = this.jobs.get(jobId);

      if (!job || job.status !== 'pending') {
        continue;
      }

      this.active++;
      job.status = 'processing';
      job.startedAt = Date.now();
      job.queuePosition = 0;

      // Update queue positions after removing this job
      this.updateQueuePositions();

      // Execute job with retry logic
      this.executeJob(job, executor).catch((err) => {
        console.error(`[ticketQueue] Job ${jobId} execution error:`, err);
      });
    }

    this.processing = false;
  }

  /**
   * Execute a single job with retry logic
   * @param {TicketJob} job
   * @param {Function} executor
   */
  async executeJob(job, executor) {
    const startTime = Date.now();
    let lastError = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await executor();
        
        // Success
        const processingTime = Date.now() - startTime;
        job.status = 'completed';
        job.ticketId = result.ticketId || null;
        job.completedAt = Date.now();
        this.active--;
        
        // Record processing time
        this.recordProcessingTime(processingTime);
        
        console.log(`[ticketQueue] Job ${job.id} completed successfully. Ticket ID: ${job.ticketId}, Processing time: ${processingTime}ms`);
        this.process(); // Process next job
        return;
      } catch (err) {
        lastError = err;
        job.retryCount = attempt + 1;
        
        console.warn(`[ticketQueue] Job ${job.id} attempt ${attempt + 1} failed:`, err?.message || err);

        // Don't retry on last attempt
        if (attempt < MAX_RETRIES) {
          // Exponential backoff: 1s, 2s, 4s
          const backoffMs = Math.pow(2, attempt) * 1000;
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }
      }
    }

    // All retries failed
    const processingTime = Date.now() - startTime;
    job.status = 'failed';
    job.error = lastError?.message || 'Unknown error';
    job.completedAt = Date.now();
    this.active--;
    
    // Record processing time even for failed jobs
    this.recordProcessingTime(processingTime);
    
    console.error(`[ticketQueue] Job ${job.id} failed after ${MAX_RETRIES} retries`);
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
      console.log(`[ticketQueue] Cleaned up old job ${jobId}`);
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
      urgentPending: 0,
      normalPending: 0,
      avgProcessingTimeMs: this.getAverageProcessingTime(),
    };

    for (const job of this.jobs.values()) {
      stats[job.status]++;
      if (job.status === 'pending') {
        if (job.priority === 'urgent') {
          stats.urgentPending++;
        } else {
          stats.normalPending++;
        }
      }
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
const ticketSubmissionQueue = new TicketSubmissionQueue();

export default ticketSubmissionQueue;
export { TicketSubmissionQueue };
