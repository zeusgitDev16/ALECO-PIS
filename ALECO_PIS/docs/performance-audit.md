# Performance Audit - ALECO PIS System

## Purpose
Audit the codebase for performance bottlenecks causing slow loading in production, even after moving Puppeteer to Cloud Run.

## IMPORTANT: Free Tier Constraints

**Current Hosting:**
- Aiven Free Tier MySQL: ~10 max connections, limited CPU/memory
- Cloud Run Free Tier: limited concurrent requests
- All hosting on free tiers - no paid upgrades available

**Constraints:**
- Cannot increase database connections beyond Aiven limits (~10 max)
- Cannot use Redis (requires separate service/cost)
- Cannot use read replicas (not available on free tier)
- Cannot use CDN (may incur cost)
- Must optimize within free tier limits

**Revised Strategy:**
Instead of scaling up resources (impossible on free tier), we optimize query efficiency so each request completes faster, freeing connections sooner. Focus on zero-cost optimizations: indexes, query refactoring, caching, and pagination.

---

## Critical Findings

### 1. Database Connection Pool - Critical but Constrained

**Current Configuration (backend/config/db.js):**
```javascript
const CONNECTION_LIMIT = 5;  // MAX 5 CONNECTIONS
const MAX_IDLE = 2;         // Keep only 2 warm
const IDLE_TIMEOUT_MS = 240000; // 4 minutes
```

**Why 5 Connections?**
- Intentionally conservative for Aiven free tier (~10 max connections)
- Leaves room for background tasks, heartbeat, IMAP poll
- Prevents connection exhaustion errors

**The Real Problem:**
- It's NOT that 5 is too few - it's that queries are too slow
- Slow queries hold connections longer
- If each query takes 200ms, a connection is tied up for 200ms
- If we optimize queries to 20ms, connections free up 10x faster
- **5 fast connections > 20 slow connections**

**Impact:**
- With slow queries, connections get tied up
- Requests queue up waiting for free connections
- User experiences slow loading

**Free Tier Solution (DO NOT increase pool size):**
- Keep CONNECTION_LIMIT at 5 (or increase slightly to 8-9 max)
- Focus on making queries faster (see below)
- Add connection release after each query (don't hold connections)
- Add query timeout to prevent long-running queries from tying up connections
- Add request queue with timeout (already partially implemented)

**What NOT to do:**
- Do NOT increase CONNECTION_LIMIT to 20-50 (will exceed Aiven limits)
- Do NOT upgrade Aiven plan (costs money)
- Do NOT add Redis (requires separate service)

**What TO do:**
- Optimize queries so they complete faster (free)
- Add indexes (free, improves query speed)
- Replace SELECT * with explicit columns (free)
- Fix N+1 queries (free)
- Add pagination (free)
- Use in-memory caching (free)

---

### 2. SELECT * Queries - Performance Anti-Pattern

**Current Code Pattern:**
Multiple instances of `SELECT *` fetching all columns:

```javascript
// tickets.js line 692
const [existing] = await connection.execute('SELECT * FROM aleco_tickets WHERE ticket_id = ?', [ticketId]);

// user.js line 56
const [existingUser] = await pool.execute('SELECT * FROM users WHERE email = ?', [cleanEmail]);

// user.js line 70
const [pendingInvite] = await pool.execute('SELECT * FROM access_codes WHERE email = ?', [cleanEmail]);

// tickets.js line 2368
const [linemen] = await pool.execute('SELECT * FROM aleco_linemen_pool ORDER BY full_name ASC');

// service-memos.js line 537
const [memoRows] = await pool.execute(`SELECT * FROM aleco_service_memos WHERE id = ?`, [id]);

// ticket-grouping.js line 164
const [groups] = await pool.execute(
    `SELECT * FROM aleco_tickets WHERE ticket_id LIKE 'GROUP-%' ORDER BY created_at DESC`
);

// ticket-grouping.js line 173
const [members] = await pool.execute(
    `SELECT * FROM aleco_tickets WHERE parent_ticket_id = ?`,
    [group.ticket_id]
);
```

**Issue:**
- Fetches ALL columns from table
- Includes unused columns (wastes memory/bandwidth)
- Slower query execution (more data transfer)
- Tables may have 20+ columns, but only need 3-5

**Impact:**
- Increased network traffic between app and DB
- Increased memory usage per query
- Slower query execution time
- Wasted I/O

**Example:**
- `aleco_tickets` has ~30 columns
- Query only needs: ticket_id, status, assigned_crew
- `SELECT *` fetches all 30 columns
- 6x more data than needed

**Solution:**
- Replace `SELECT *` with explicit column list
- Only fetch columns needed for the operation
- Example:
  ```javascript
  // Before
  const [existing] = await pool.execute('SELECT * FROM aleco_tickets WHERE ticket_id = ?', [ticketId]);
  
  // After
  const [existing] = await pool.execute(
    'SELECT ticket_id, status, assigned_crew, updated_at FROM aleco_tickets WHERE ticket_id = ?',
    [ticketId]
  );
  ```

---

### 3. N+1 Query Problem - ticket-grouping.js

**Current Code (ticket-grouping.js lines 160-184):**
```javascript
router.get('/tickets/groups', requireStaff, async (req, res) => {
    try {
        // Query 1: Get all groups
        const [groups] = await pool.execute(
            `SELECT * FROM aleco_tickets WHERE ticket_id LIKE 'GROUP-%' ORDER BY created_at DESC`
        );

        // For EACH group, execute another query (N+1 problem)
        const groupsWithMembers = await Promise.all(
            groups.map(async (group) => {
                const [members] = await pool.execute(
                    `SELECT * FROM aleco_tickets WHERE parent_ticket_id = ?`,
                    [group.ticket_id]
                );
                return {
                    ...mapTicketRowToDto(group),
                    ticket_count: members.length,
                    tickets: members.map(mapTicketRowToDto)
                };
            })
        );
    }
});
```

**Issue:**
- 1 query to get groups
- N queries to get members (one per group)
- If 50 groups, that's 51 queries
- Each query requires DB connection
- Total time = sum of all query times

**Impact:**
- With 50 groups: 51 queries
- Each query takes ~10ms
- Total: 510ms for one API call
- User experiences slow loading

**Solution:**
- Use JOIN to fetch groups and members in one query
- Or use IN clause with subquery
- Example:
  ```javascript
  const [groups] = await pool.execute(`
    SELECT 
      g.*,
      COUNT(t.ticket_id) as ticket_count
    FROM aleco_tickets g
    LEFT JOIN aleco_tickets t ON t.parent_ticket_id = g.ticket_id
    WHERE g.ticket_id LIKE 'GROUP-%'
    GROUP BY g.ticket_id
    ORDER BY g.created_at DESC
  `);
  ```

---

### 4. No Database Indexes - Missing Performance Optimization

**Current State:**
- No CREATE INDEX statements found in code
- Queries filter by columns that may not be indexed
- No index strategy visible

**Queries That Need Indexes:**
```javascript
// Filter by ticket_id - needs index on ticket_id
SELECT * FROM aleco_tickets WHERE ticket_id = ?

// Filter by email - needs index on email
SELECT * FROM users WHERE email = ?
SELECT * FROM access_codes WHERE email = ?

// Filter by parent_ticket_id - needs index on parent_ticket_id
SELECT * FROM aleco_tickets WHERE parent_ticket_id = ?

// Filter by assigned_crew and status - needs composite index
SELECT COUNT(*) as count FROM aleco_tickets WHERE assigned_crew = ? AND status = 'Ongoing'

// Filter by crew_name - needs index on crew_name
SELECT status FROM aleco_personnel WHERE crew_name = ?

// Filter by phone_number - needs index on phone_number
SELECT crew_name FROM aleco_personnel WHERE phone_number = ?
```

**Impact:**
- Without indexes, MySQL does full table scan
- Full table scan on large tables = very slow
- Example: 100,000 tickets, scan all 100,000 rows
- With index: direct lookup (O(log n))

**Solution:**
- Add indexes on frequently filtered columns
- Add composite indexes for multi-column filters
- Example:
  ```sql
  CREATE INDEX idx_tickets_ticket_id ON aleco_tickets(ticket_id);
  CREATE INDEX idx_tickets_parent_ticket_id ON aleco_tickets(parent_ticket_id);
  CREATE INDEX idx_tickets_assigned_crew_status ON aleco_tickets(assigned_crew, status);
  CREATE INDEX idx_users_email ON users(email);
  CREATE INDEX idx_personnel_crew_name ON aleco_personnel(crew_name);
  CREATE INDEX idx_personnel_phone ON aleco_personnel(phone_number);
  ```

---

### 5. No Caching Layer - Repeated Database Hits

**Current Code (smsTemplate.js lines 50-65):**
```javascript
async function fetchSmsSettings() {
  try {
    const [rows] = await pool.execute(
      'SELECT setting_key, setting_value FROM aleco_site_settings WHERE setting_key LIKE ?',
      ['sms_%']
    );
    const settings = {};
    rows.forEach((row) => {
      settings[row.setting_key] = row.setting_value;
    });
    return settings;
  } catch (error) {
    console.error('[smsTemplate] Failed to fetch SMS settings:', error);
    return {};
  }
}
```

**Issue:**
- SMS settings fetched from database on every SMS send
- Settings rarely change
- Wastes database connections
- Adds latency to every SMS operation

**Impact:**
- Every SMS send = 1 DB query
- 100 SMS sends = 100 DB queries
- Each query takes ~5-10ms
- Total: 500-1000ms wasted

**Other Areas Needing Caching:**
- Urgent keywords (fetched on every ticket submission)
- District-municipality map (static data)
- Crew list (fetched repeatedly)
- Site settings (fetched repeatedly)

**Free Tier Solution (No Redis):**
- Use in-memory cache (JavaScript Map/WeakMap)
- Cache SMS settings with TTL (e.g., 5 minutes)
- Cache urgent keywords with TTL
- Cache static data (district map, crew list)
- Cache persists for process lifetime (sufficient for single-instance deployment)
- Example:
  ```javascript
  const cache = new Map();
  
  async function fetchSmsSettings() {
    // Check cache first
    const cached = cache.get('sms_settings');
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }
    
    // Fetch from DB
    const [rows] = await pool.execute(
      'SELECT setting_key, setting_value FROM aleco_site_settings WHERE setting_key LIKE ?',
      ['sms_%']
    );
    const settings = {};
    rows.forEach((row) => {
      settings[row.setting_key] = row.setting_value;
    });
    
    // Cache for 5 minutes (300000 ms)
    cache.set('sms_settings', { data: settings, expiry: Date.now() + 300000 });
    return settings;
  }
  ```

---

### 6. No Query Optimization - No EXPLAIN ANALYZE

**Current State:**
- No EXPLAIN ANALYZE visible in code
- No query performance monitoring
- No slow query logging
- No query optimization process

**Issue:**
- Don't know which queries are slow
- Don't know if indexes are being used
- Don't know query execution plans
- Can't optimize without data

**Solution:**
- Enable slow query logging in MySQL
- Add query performance monitoring
- Run EXPLAIN ANALYZE on slow queries
- Add query execution time logging
- Example:
  ```javascript
  const startTime = Date.now();
  const [rows] = await pool.execute(sql, params);
  const duration = Date.now() - startTime;
  if (duration > 100) {
    console.warn(`Slow query (${duration}ms):`, sql);
  }
  ```

---

### 7. Large Result Sets - No Pagination Optimization

**Current Code (ticket-grouping.js line 164):**
```javascript
const [groups] = await pool.execute(
    `SELECT * FROM aleco_tickets WHERE ticket_id LIKE 'GROUP-%' ORDER BY created_at DESC`
);
```

**Issue:**
- Fetches ALL groups at once
- No LIMIT clause
- No pagination
- If 1000 groups, fetches all 1000

**Impact:**
- Large result sets consume memory
- Large result sets take longer to transfer
- Large result sets slow down rendering
- Scales poorly as data grows

**Solution:**
- Add pagination (LIMIT, OFFSET)
- Add cursor-based pagination for better performance
- Example:
  ```javascript
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  
  const [groups] = await pool.execute(
    `SELECT * FROM aleco_tickets 
     WHERE ticket_id LIKE 'GROUP-%' 
     ORDER BY created_at DESC 
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  ```

---

### 8. No Database Connection Pooling for Read Replicas

**Current State:**
- Single database connection pool
- All queries go to same database
- No read replica separation
- No write/read splitting

**Issue:**
- Read queries compete with write queries for connections
- Can't scale read operations independently
- Single point of failure

**Solution:**
- Set up read replica (if using Aiven)
- Separate read pool and write pool
- Route SELECT queries to read pool
- Route INSERT/UPDATE/DELETE to write pool

---

### 9. Synchronous SMS Sending - Blocks Request

**Current Code (tickets.js line 940):**
```javascript
const linemanSmsResult = await sendPhilSMS(lineman_phone, linemanMsg);
```

**Issue:**
- SMS sent synchronously
- Request waits for SMS to send
- SMS API call takes ~500-1000ms
- Blocks request completion

**Impact:**
- Dispatch request takes 1s longer
- User experiences delay
- Ties up database connection during SMS send

**Solution:**
- Move SMS sending to background queue
- Use Bull or similar queue
- Return response immediately
- Process SMS in background

---

### 10. No Frontend Optimization

**Current State:**
- No frontend code reviewed in this audit
- Likely issues:
  - No code splitting
  - No lazy loading
  - No image optimization
  - No bundle size optimization

**Potential Issues:**
- Large JavaScript bundle
- Slow initial load
- No caching strategy
- No CDN usage

**Solution:**
- Implement code splitting
- Implement lazy loading
- Optimize images
- Use CDN for static assets
- Add service worker for caching

---

## Free Tier Performance Improvement Plan

### Immediate (Critical - Do First, All Free)

1. **Add Database Indexes (FREE)**
   - Add index on `aleco_tickets.ticket_id`
   - Add index on `aleco_tickets.parent_ticket_id`
   - Add composite index on `aleco_tickets(assigned_crew, status)`
   - Add index on `users.email` and `access_codes.email`
   - Add index on `aleco_personnel.crew_name` and `aleco_personnel.phone_number`
   - Expected improvement: 50-80% reduction in query time for filtered queries
   - Cost: FREE (indexes are free on Aiven)

2. **Replace SELECT * with Explicit Columns (FREE)**
   - Audit all SELECT * queries in codebase
   - Replace with explicit column lists
   - Expected improvement: 20-30% reduction in query time and memory usage
   - Cost: FREE (just code changes)

3. **Fix N+1 Query Problem (FREE)**
   - Rewrite `ticket-grouping.js` to use JOIN instead of multiple queries
   - Audit other areas for N+1 problems
   - Expected improvement: 80-90% reduction in query count for grouped operations
   - Cost: FREE (just code changes)

### Short-term (High Priority, All Free)

4. **Add In-Memory Caching (FREE)**
   - Use JavaScript Map for caching (no Redis needed)
   - Cache SMS settings with 5-minute TTL
   - Cache urgent keywords with 5-minute TTL
   - Cache district-municipality map (static data)
   - Cache crew list with 5-minute TTL
   - Expected improvement: 50-70% reduction in DB hits for repeated queries
   - Cost: FREE (uses application memory)

5. **Add Pagination (FREE)**
   - Add LIMIT/OFFSET to list queries (groups, tickets, memos)
   - Implement cursor-based pagination for better performance
   - Expected improvement: 60-80% reduction in memory usage for large datasets
   - Cost: FREE (just code changes)

6. **Add Query Timeout (FREE)**
   - Add query timeout to prevent long-running queries from tying up connections
   - Set timeout to 5 seconds max
   - Expected improvement: Prevents connection pool exhaustion
   - Cost: FREE (just code changes)

### Medium-term (Medium Priority, All Free)

7. **Add Query Monitoring (FREE)**
   - Enable slow query logging in MySQL
   - Add query execution time logging in code
   - Log queries taking >100ms
   - Expected improvement: Better visibility into performance issues
   - Cost: FREE (built into MySQL)

8. **Move SMS to In-Memory Queue (FREE)**
   - Use JavaScript array/queue instead of Bull (no Redis needed)
   - Process SMS asynchronously in background
   - Return response immediately, queue SMS for later
   - Expected improvement: 500-1000ms reduction in request time
   - Cost: FREE (uses application memory)

9. **Optimize Connection Usage (FREE)**
   - Ensure connections are released immediately after query
   - Don't hold connections during business logic
   - Use connection pooling efficiently
   - Expected improvement: 30-50% better connection utilization
   - Cost: FREE (just code changes)

### Long-term (Lower Priority, Some May Require Cost)

10. **Frontend Optimization (FREE)**
    - Code splitting with React.lazy()
    - Lazy loading for components
    - Image optimization (compress images before upload)
    - Minimize JavaScript bundle size
    - Expected improvement: Faster initial load
    - Cost: FREE (just code changes)

11. **Database Archiving (FREE)**
    - Archive old tickets (e.g., >1 year) to separate table
    - Keep only active tickets in main table
    - Expected improvement: Smaller table size = faster queries
    - Cost: FREE (just SQL queries)

### What We CANNOT Do (Requires Paid Tier)

- Increase connection pool beyond ~8-9 (Aiven free tier limit ~10)
- Use Redis (requires separate service)
- Use read replicas (not available on free tier)
- Use CDN (may incur cost)
- Upgrade Aiven plan (costs money)
- Use paid monitoring tools
- Horizontal scaling (requires load balancer, multiple instances)

---

## Expected Performance Improvements (Free Tier Only)

**After Immediate Fixes (Indexes, SELECT *, N+1):**
- Indexes: 50-80% reduction in query time for filtered queries
- SELECT * optimization: 20-30% reduction in query time and memory
- N+1 fix: 80-90% reduction in query count for grouped operations
- **Total expected improvement: 3-5x faster**

**After All Free Fixes:**
- In-memory caching: 50-70% reduction in DB hits for repeated queries
- Pagination: 60-80% reduction in memory usage for large datasets
- Background SMS: 500-1000ms reduction in request time
- Connection optimization: 30-50% better connection utilization
- **Total expected improvement: 5-10x faster**

---

## Free Tier Monitoring Recommendations

1. **Database Connection Pool Monitoring (FREE)**
   - Log active connections periodically
   - Log queue wait time
   - Alert when queue exceeds 10 requests
   - Use console logs (no paid monitoring needed)

2. **Query Performance Monitoring (FREE)**
   - Log query execution time in code
   - Log slow queries (>100ms)
   - Enable MySQL slow query log
   - Review logs periodically

3. **API Response Time Monitoring (FREE)**
   - Log API response time in code
   - Log p50, p95, p99 latency
   - Use console logs

---

## Conclusion (Free Tier Focus)

The primary cause of slow performance is **inefficient queries** combined with a small connection pool. On free tier, we cannot increase the connection pool significantly, so we must focus on making each query faster.

**Key Insight:** 5 fast connections are better than 20 slow connections.

**Free Tier Priority Order:**
1. Add indexes (CRITICAL, FREE)
2. Replace SELECT * (CRITICAL, FREE)
3. Fix N+1 queries (HIGH, FREE)
4. Add in-memory caching (HIGH, FREE)
5. Add pagination (MEDIUM, FREE)
6. Move SMS to background (MEDIUM, FREE)
7. Optimize connection usage (MEDIUM, FREE)
8. Add query monitoring (LOW, FREE)
