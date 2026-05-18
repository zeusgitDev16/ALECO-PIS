import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
// Removed mysql, nodemailer, bcrypt, and cloudinary - they are all handled by the bricks now!

import { buildAllowedCorsOrigins, normalizeOrigin, hasExplicitPublicCorsEnv } from './backend/config/corsOrigins.js';

// 1. Initialize environment variables & Lego Bricks
import authRoutes from './backend/routes/auth.js';
import ticketRoutes from './backend/routes/tickets.js';
import userRoutes from './backend/routes/user.js'; // <-- NEW: Imported your Admin brick
import ticketFilterRoutes from './backend/routes/ticket-routes.js';
import ticketGroupingRoutes from './backend/routes/ticket-grouping.js'; // <-- NEW: Ticket Grouping System
import contactNumbersRoutes from './backend/routes/contact-numbers.js';
import urgentKeywordsRoutes from './backend/routes/urgent-keywords.js';
import backupRoutes from './backend/routes/backup.js';
import interruptionsRoutes from './backend/routes/interruptions.js';
import feedersRoutes from './backend/routes/feeders.js';
import b2bMailRoutes from './backend/routes/b2b-mail.js';
import serviceMemosRoutes from './backend/routes/service-memos.js';
import notificationsRoutes from './backend/routes/notifications.js';
import historyRoutes from './backend/routes/history.js';
import siteSettingsRoutes from './backend/routes/site-settings.js';
import pool, { getHeartbeatStats } from './backend/config/db.js';
import {
  transitionScheduledStarts,
  autoArchiveResolvedInterruptions,
} from './backend/services/interruptionLifecycle.js';
import { pollB2BInboundOnce } from './backend/services/b2bInboundImapPoll.js';
import { requireApiSession } from './backend/middleware/requireApiSession.js';

const __serverFilename = fileURLToPath(import.meta.url);
const __serverDirname  = dirname(__serverFilename);
dotenv.config({ path: resolve(__serverDirname, '.env') });

process.env.TZ = 'Asia/Manila';

const app = express();
const httpServer = http.createServer(app);
// Render (and most hosts) assign PORT via env; local dev uses 5000
const PORT = Number(process.env.PORT) || 5000;

// Behind Render / reverse proxies — correct client IP for any future rate limiting / logs
app.set('trust proxy', 1);

const allowedOrigins = buildAllowedCorsOrigins();
console.log(`[cors] ${allowedOrigins.length} allowed origin(s) (CORS_ALLOWED_ORIGINS, PUBLIC_APP_URL / FRONTEND_ORIGIN)`);
if (process.env.NODE_ENV === 'production' && !hasExplicitPublicCorsEnv()) {
    console.warn(
        '[cors] WARNING: No PUBLIC_APP_URL, FRONTEND_ORIGIN, or CORS_ALLOWED_ORIGINS set. ' +
            'Browser clients loading your deployed SPA from an HTTPS origin will be blocked by CORS until at least one is set on this API host.'
    );
}

// Backup/export GETs send X-User-Email / X-User-Name — browsers preflight unless these are allowed.
// Expose Content-Disposition so cross-origin fetch() can read the download filename (see Backup.jsx).
const corsOptions = {
    origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(normalizeOrigin(origin))) return callback(null, true);
        console.warn(`[cors] blocked origin: ${origin}`);
        return callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-User-Email', 'X-User-Name', 'X-Token-Version'],
    exposedHeaders: ['Content-Disposition'],
};

const io = new SocketIOServer(httpServer, {
    cors: {
        origin(origin, callback) {
            if (!origin) return callback(null, true);
            if (allowedOrigins.includes(normalizeOrigin(origin))) return callback(null, true);
            return callback(null, false);
        },
        methods: ['GET', 'POST'],
    },
    path: '/socket.io',
});

io.on('connection', (socket) => {
    socket.emit('realtime:connected', {
        ts: new Date().toISOString(),
        transport: socket.conn?.transport?.name || 'unknown',
    });
});

function moduleFromApiPath(pathname) {
    const p = String(pathname || '').toLowerCase();
    if (p.includes('/crews') || p.includes('/pool')) return 'personnel';
    if (p.includes('/tickets')) return 'tickets';
    if (p.includes('/interruptions')) return 'interruptions';
    if (p.includes('/service-memos') || p.includes('/memo')) return 'service-memos';
    if (p.includes('/b2b-mail')) return 'b2b-mail';
    if (p.includes('/users') || p.includes('/invite') || p.includes('/send-email')) return 'users';
    if (p.includes('/notifications')) return 'notifications';
    if (p.includes('/backup') || p.includes('/export') || p.includes('/import') || p.includes('/archive')) return 'data-management';
    if (p.includes('/history')) return 'history';
    if (p.includes('/feeders')) return 'feeders';
    return 'system';
}

// ES module equivalent of __dirname (not available natively in ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// 2. Middleware (The Guards)
app.use(cors(corsOptions));
app.use(express.json());

// 🔥 DYNAMIC RENDERING for Facebook/Twitter crawlers (SEO/Open Graph)
// Detects bots and serves pre-rendered HTML with meta tags
const BOT_USER_AGENTS = [
  'facebookexternalhit',
  'Facebot',
  'Twitterbot',
  'LinkedInBot',
  'WhatsApp',
  'TelegramBot',
  'Discordbot',
  'Slackbot',
  'Googlebot',
  'Instagram',
  'Pinterest',
  'Snapchat',
  'bingbot',
  'yandex',
  'duckduckbot',
  'baiduspider',
  'curl',
  'wget',
  'postman',
];

function isBot(userAgent) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return BOT_USER_AGENTS.some(bot => ua.includes(bot.toLowerCase()));
}

// Helper function to serve bot HTML for advisory pages
async function serveAdvisoryBotHtml(req, res, next, advisoryId, canonicalUrl) {
  if (!Number.isFinite(advisoryId) || advisoryId <= 0) {
    return next();
  }
  
  try {
    // Fetch advisory data from database
    // Note: i.* includes poster_image_url, feeder, status, affected_areas, etc.
    const [rows] = await pool.execute(
      `SELECT * FROM aleco_interruptions WHERE id = ? LIMIT 1`,
      [advisoryId]
    );
    
    const item = rows[0];
    console.log(`[bot-render] DB fetch for advisory ${advisoryId}: found=${!!item}, poster_url=${item?.poster_image_url}`);
    
    if (!item) {
      // Advisory not found - serve default OG tags
      return res.send(generateBotHtml(null, advisoryId, req, canonicalUrl));
    }
    
    // Generate HTML with OG tags for this advisory
    res.send(generateBotHtml(item, advisoryId, req, canonicalUrl));
  } catch (err) {
    console.error('[bot-render] Error fetching advisory:', err);
    next(); // Fall back to normal React app
  }
}

// Debug endpoint to check if bot detection works
app.get('/debug/bot-test', (req, res) => {
  const ua = req.headers['user-agent'] || 'none';
  const isBotResult = isBot(ua);
  res.json({
    userAgent: ua,
    isBot: isBotResult,
    botList: BOT_USER_AGENTS,
    timestamp: new Date().toISOString()
  });
});

// Redirect old /advisory/:id links to new /poster/interruption/:id for humans
// BUT serve OG tags directly to bots (don't redirect bots)
app.get('/advisory/:id', async (req, res, next) => {
  const userAgent = req.headers['user-agent'] || '';
  const advisoryId = parseInt(req.params.id, 10);
  
  // For bots: serve OG tags directly at this URL (don't redirect)
  if (isBot(userAgent)) {
    console.log(`[bot-render] Bot detected for /advisory/${advisoryId}: ${userAgent.slice(0, 50)}...`);
    const canonicalUrl = `${req.protocol}://${req.get('host')}/advisory/${advisoryId}`;
    return await serveAdvisoryBotHtml(req, res, next, advisoryId, canonicalUrl);
  }
  console.log(`[bot-render] Human detected for /advisory/${advisoryId}, redirecting to /poster/interruption/${advisoryId}`);
  
  // For humans: redirect to the new URL
  res.redirect(301, `/poster/interruption/${advisoryId}`);
});

// Serve advisory pages with OG tags for bots at the canonical URL
// Matches the React Router path: /poster/interruption/:id
app.get('/poster/interruption/:id', async (req, res, next) => {
  const userAgent = req.headers['user-agent'] || '';
  const advisoryId = parseInt(req.params.id, 10);
  
  // For bots: serve OG tags directly
  if (isBot(userAgent)) {
    console.log(`[bot-render] Bot detected for /poster/interruption/${advisoryId}`);
    const canonicalUrl = `${req.protocol}://${req.get('host')}/poster/interruption/${advisoryId}`;
    return await serveAdvisoryBotHtml(req, res, next, advisoryId, canonicalUrl);
  }
  
  // For humans: redirect to frontend (Cloudflare Pages)
  console.log(`[bot-render] Human detected, redirecting to frontend`);
  res.redirect(301, `https://apisph.org/poster/interruption/${advisoryId}`);
});

function generateBotHtml(item, advisoryId, req, canonicalUrl) {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  // The URL that Facebook should use as canonical (where the OG tags are served from)
  const pageUrl = canonicalUrl || `${baseUrl}/advisory/${advisoryId}`;
  // The URL where humans should go (React app on Cloudflare Pages)
  const advisoryUrl = `https://apisph.org/poster/interruption/${advisoryId}`;
  
  let title, description, imageUrl, imageAlt;
  
  if (item) {
    // Database columns are snake_case: affected_areas, date_time_start, poster_image_url
    const areas = item.affected_areas || 'Affected areas';
    title = `Power Interruption Advisory - ${item.feeder} | ${item.status}`;
    description = `Scheduled power interruption for ${areas}. Status: ${item.status}.`;
    
    // poster_image_url is a full Cloudinary URL (e.g., https://res.cloudinary.com/...)
    // Use it directly, fall back to og-default only if missing
    const posterUrl = item.poster_image_url;
    if (posterUrl && posterUrl.startsWith('http')) {
      imageUrl = posterUrl;
    } else {
      imageUrl = `${baseUrl}/og-default.jpg`;
    }
    imageAlt = `Power interruption advisory poster for ${item.feeder}`;
  } else {
    title = 'ALECO Power Interruption Advisory';
    description = 'View the latest power interruption advisory from Albay Electric Cooperative.';
    imageUrl = `${baseUrl}/og-default.jpg`;
    imageAlt = 'ALECO Power Information System';
  }
  
  // Debug logging
  console.log(`[bot-render] Advisory ${advisoryId}: poster_image_url=${item?.poster_image_url}, imageUrl=${imageUrl}`);
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${pageUrl}">
  
  <!-- Open Graph tags for Facebook -->
  <meta property="og:type" content="article">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escapeHtml(imageAlt)}">
  <meta property="og:site_name" content="ALECO PIS">
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${imageUrl}">
  
  <!-- Link to full page for humans -->
  <link rel="alternate" href="${advisoryUrl}" />
</head>
<body style="margin:0; padding:20px; font-family:system-ui,sans-serif; background:#f5f7fb;">
  <div style="max-width:800px; margin:0 auto; background:white; border-radius:12px; box-shadow:0 4px 20px rgba(0,0,0,0.1); overflow:hidden;">
    <!-- Poster Image -->
    <img src="${imageUrl}" alt="${escapeHtml(imageAlt)}" style="width:100%; height:auto; display:block;">
    
    <!-- Advisory Details -->
    <div style="padding:24px; background:#f8f9fa; border-top:1px solid #e0e0e0;">
      <h1 style="margin:0 0 16px 0; font-size:1.5rem; color:#1a1a1a;">${escapeHtml(title)}</h1>
      <p style="margin:8px 0; line-height:1.6; color:#444;">${escapeHtml(description)}</p>
      <p style="margin-top:16px;"><a href="${advisoryUrl}" style="color:#0066cc; text-decoration:none; font-weight:600;">View full advisory →</a></p>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Serve static assets from the Vite production build (dist/) and the public/ folder.
// dist/ contains the compiled frontend + all public/ files copied by Vite at build time.
// public/ is a fallback for running Express directly without a prior build.
app.use(express.static(join(__dirname, 'dist')));
app.use(express.static(join(__dirname, 'public')));

// Global realtime broadcaster for successful write operations.
app.use('/api', (req, res, next) => {
    const method = String(req.method || '').toUpperCase();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return next();

    const startedAt = Date.now();
    res.on('finish', () => {
        if (res.statusCode < 200 || res.statusCode >= 400) return;
        const path = req.originalUrl || req.path || '';
        const module = moduleFromApiPath(path);
        const actorEmail = req.authUser?.email || null;
        io.emit('realtime:entity-changed', {
            module,
            method,
            path,
            actorEmail,
            statusCode: res.statusCode,
            ts: new Date().toISOString(),
            durationMs: Date.now() - startedAt,
        });
    });
    return next();
});

/** Uptime / load balancer — no DB (Render health checks). Must be registered before the API session gate. */
app.get('/api/health', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ ok: true, service: 'aleco-pis-api', ts: new Date().toISOString() });
});

/** DB connectivity diagnostic — shows heartbeat, circuit breaker, and queue status.
 *  Intentionally public (no auth) so Oracle VM monitoring scripts / uptime checkers
 *  can hit it without credentials. Returns 503 if the DB is considered unhealthy. */
app.get('/api/db-health', (req, res) => {
    res.set('Cache-Control', 'no-store');
    const stats = getHeartbeatStats();
    const ok = stats.heartbeat.healthy && stats.circuitState === 'closed';
    res.status(ok ? 200 : 503).json({
        ok,
        ts: new Date().toISOString(),
        ...stats,
    });
});

// Protected API routes require X-User-Email + X-Token-Version (see requireApiSession.js public allowlist).
app.use('/api', requireApiSession);

// 3. Mount the Lego Bricks
// Every route you had before still perfectly exists at the exact same /api URL
app.use('/api', authRoutes);
app.use('/api', backupRoutes); // Must be before tickets for /tickets/export, /tickets/archive, /tickets/import
app.use('/api', ticketRoutes);
app.use('/api', userRoutes);
app.use('/api', ticketFilterRoutes); // <-- Admin filter brick
app.use('/api', ticketGroupingRoutes); // <-- NEW: Ticket Grouping System
app.use('/api', interruptionsRoutes); // Power advisory / aleco_interruptions
app.use('/api', contactNumbersRoutes);
app.use('/api', urgentKeywordsRoutes);
app.use('/api', feedersRoutes);
app.use('/api', b2bMailRoutes);
app.use('/api', serviceMemosRoutes);
app.use('/api', notificationsRoutes);
app.use('/api', historyRoutes);
app.use('/api', siteSettingsRoutes);

app.get('/api/debug/routes', (req, res) => {
    res.json({
        message:
            'Route inventory (Express mounts at /api/*). Protected routes require Authorization: Bearer JWT (login/google-login) and/or legacy X-User-Email + X-Token-Version; admin dashboards use DB role checks (see backend/middleware/requireApiSession.js, requireRole.js).',
        health: 'GET /api/health',
        auth: [
            'POST /api/setup-account',
            'POST /api/login',
            'POST /api/google-login',
            'POST /api/setup-google-account',
            'POST /api/logout-all',
            'POST /api/forgot-password',
            'POST /api/reset-password',
            'POST /api/verify-session',
        ],
        ticketsPublic: [
            'POST /api/tickets/submit',
            'GET /api/tickets/track/:ticketId',
            'POST /api/check-duplicates',
            'POST /api/tickets/send-copy',
        ],
        ticketsAdmin: [
            'GET /api/filtered-tickets',
            'PUT /api/tickets/:ticketId',
            'DELETE /api/tickets/:ticketId',
            'GET /api/tickets/logs',
            'GET /api/tickets/:ticketId/logs',
            'PUT /api/tickets/:ticketId/status',
            'GET /api/crews/list',
            'POST /api/crews/add',
            'PUT /api/crews/update/:id',
            'DELETE /api/crews/delete/:id',
            'GET /api/pool/list',
            'POST /api/pool/add',
            'PUT /api/pool/update/:id',
            'DELETE /api/pool/delete/:id',
            '…grouping / dispatch / hold / SMS webhook — see tickets.js & ticket-grouping.js',
        ],
        users: [
            'POST /api/invite',
            'POST /api/send-email',
            'POST /api/check-email',
            'GET /api/users',
            'PUT /api/users/profile',
            'POST /api/users/toggle-status',
            'GET /api/notifications?tab=user',
            'GET /api/notifications?tab=personnel',
            'GET /api/notifications?tab=b2b-mail',
            'GET /api/notifications?tab=tickets',
            'GET /api/notifications?tab=interruptions',
            'GET /api/notifications?tab=memo',
            'GET /api/notifications/counts',
            'POST /api/notifications/mark-all-read',
            'PATCH /api/notifications/:id/read',
        ],
        interruptions: [
            'GET /api/interruptions',
            'POST /api/interruptions',
            'GET /api/interruptions/:id',
            'PUT /api/interruptions/:id',
            'DELETE /api/interruptions/:id',
            '…updates, archive, feed — see interruptions.js',
        ],
        other: [
            'GET /api/contact-numbers',
            'GET|POST|PUT|PATCH /api/b2b-mail/* (inbound IMAP poll when B2B_INBOUND_IMAP_ENABLED=true)',
            'GET|POST … /api/tickets/export, import, archive — backup.js',
        ],
        deployment: {
            frontend: 'Vercel (VITE_API_URL → this API origin)',
            api: 'Render or any Node host; CORS must allow Vercel origin',
            envHints: ['CORS_ALLOWED_ORIGINS', 'PUBLIC_APP_URL or FRONTEND_ORIGIN'],
        },
    });
});

// 4. Start the Office
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);

  const runScheduledInterruptionTransition = () => {
    transitionScheduledStarts(pool).catch((err) =>
      console.error('[interruptions] scheduled start transition:', err.message || err)
    );
  };
  runScheduledInterruptionTransition();
  setInterval(runScheduledInterruptionTransition, 60_000);

  const runAutoArchiveResolved = () => {
    autoArchiveResolvedInterruptions(pool).catch((err) =>
      console.error('[interruptions] auto-archive resolved:', err.message || err)
    );
  };
  runAutoArchiveResolved();
  setInterval(runAutoArchiveResolved, 5 * 60_000); // every 5 minutes

  const runB2BInboundPoll = () => {
    pollB2BInboundOnce().catch((err) =>
      console.error('[b2b-mail] inbound IMAP poll:', err?.message || err)
    );
  };
  runB2BInboundPoll();
  setInterval(runB2BInboundPoll, 5 * 60_000);
}); // deploy test comment