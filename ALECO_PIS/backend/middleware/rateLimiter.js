/**
 * In-Memory Rate Limiter
 * Prevents abuse and burst traffic for ticket submissions
 */

/**
 * @typedef {Object} RateLimitEntry
 * @property {number[]} timestamps
 * @property {number} count
 */

// In-memory storage for rate limits
const ipLimits = new Map(); // IP -> RateLimitEntry
const phoneLimits = new Map(); // Phone number -> RateLimitEntry

// Configuration
const IP_LIMIT = 5; // 5 requests per minute per IP
const PHONE_LIMIT = 10; // 10 requests per hour per phone
const IP_WINDOW_MS = 60 * 1000; // 1 minute
const PHONE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/**
 * Clean up old entries from rate limit maps
 */
function cleanup() {
  const now = Date.now();
  
  // Clean IP limits
  for (const [ip, entry] of ipLimits.entries()) {
    entry.timestamps = entry.timestamps.filter(ts => now - ts < IP_WINDOW_MS);
    if (entry.timestamps.length === 0) {
      ipLimits.delete(ip);
    }
  }
  
  // Clean phone limits
  for (const [phone, entry] of phoneLimits.entries()) {
    entry.timestamps = entry.timestamps.filter(ts => now - ts < PHONE_WINDOW_MS);
    if (entry.timestamps.length === 0) {
      phoneLimits.delete(phone);
    }
  }
}

/**
 * Check if IP is rate limited
 * @param {string} ip
 * @returns {Object} { allowed: boolean, remaining: number, resetAt: number }
 */
function checkIPRateLimit(ip) {
  const now = Date.now();
  
  if (!ipLimits.has(ip)) {
    ipLimits.set(ip, { timestamps: [], count: 0 });
  }
  
  const entry = ipLimits.get(ip);
  
  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter(ts => now - ts < IP_WINDOW_MS);
  entry.count = entry.timestamps.length;
  
  if (entry.count >= IP_LIMIT) {
    // Find when the oldest timestamp will expire
    const oldestTimestamp = Math.min(...entry.timestamps);
    const resetAt = oldestTimestamp + IP_WINDOW_MS;
    return { allowed: false, remaining: 0, resetAt };
  }
  
  // Add current timestamp
  entry.timestamps.push(now);
  entry.count++;
  
  const remaining = IP_LIMIT - entry.count;
  const resetAt = entry.timestamps[0] + IP_WINDOW_MS;
  
  return { allowed: true, remaining, resetAt };
}

/**
 * Check if phone number is rate limited
 * @param {string} phone
 * @returns {Object} { allowed: boolean, remaining: number, resetAt: number }
 */
function checkPhoneRateLimit(phone) {
  if (!phone) {
    return { allowed: true, remaining: PHONE_LIMIT, resetAt: Date.now() + PHONE_WINDOW_MS };
  }
  
  const now = Date.now();
  
  if (!phoneLimits.has(phone)) {
    phoneLimits.set(phone, { timestamps: [], count: 0 });
  }
  
  const entry = phoneLimits.get(phone);
  
  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter(ts => now - ts < PHONE_WINDOW_MS);
  entry.count = entry.timestamps.length;
  
  if (entry.count >= PHONE_LIMIT) {
    // Find when the oldest timestamp will expire
    const oldestTimestamp = Math.min(...entry.timestamps);
    const resetAt = oldestTimestamp + PHONE_WINDOW_MS;
    return { allowed: false, remaining: 0, resetAt };
  }
  
  // Add current timestamp
  entry.timestamps.push(now);
  entry.count++;
  
  const remaining = PHONE_LIMIT - entry.count;
  const resetAt = entry.timestamps[0] + PHONE_WINDOW_MS;
  
  return { allowed: true, remaining, resetAt };
}

/**
 * Rate limiting middleware for ticket submissions
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
export function rateLimitTicketSubmission(req, res, next) {
  // Run cleanup periodically (every 100 requests to avoid performance impact)
  if (Math.random() < 0.01) {
    cleanup();
  }
  
  // Get IP from request
  const ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
  
  // Check IP rate limit
  const ipCheck = checkIPRateLimit(ip);
  if (!ipCheck.allowed) {
    const retryAfter = Math.ceil((ipCheck.resetAt - Date.now()) / 1000);
    res.setHeader('Retry-After', retryAfter);
    return res.status(429).json({
      success: false,
      message: `Too many requests from your location. Please try again in ${retryAfter} seconds.`,
      retryAfter,
    });
  }
  
  // Check phone rate limit (if phone number is provided)
  const phone = req.body?.phone_number || req.body?.phoneNumber;
  if (phone) {
    const phoneCheck = checkPhoneRateLimit(phone);
    if (!phoneCheck.allowed) {
      const retryAfter = Math.ceil((phoneCheck.resetAt - Date.now()) / 1000);
      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({
        success: false,
        message: `Too many submissions from this phone number. Please try again in ${Math.ceil(retryAfter / 60)} minutes.`,
        retryAfter,
      });
    }
  }
  
  // Add rate limit headers
  res.setHeader('X-RateLimit-Limit', `${IP_LIMIT}`);
  res.setHeader('X-RateLimit-Remaining', ipCheck.remaining);
  res.setHeader('X-RateLimit-Reset', new Date(ipCheck.resetAt).toISOString());
  
  next();
}

/**
 * Get rate limit statistics (for monitoring)
 * @returns {Object}
 */
export function getRateLimitStats() {
  return {
    ipTracked: ipLimits.size,
    phoneTracked: phoneLimits.size,
  };
}

/**
 * Clear all rate limits (for testing/admin use)
 */
export function clearRateLimits() {
  ipLimits.clear();
  phoneLimits.clear();
}
