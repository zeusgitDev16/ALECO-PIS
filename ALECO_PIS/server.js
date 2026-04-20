import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
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
import pool from './backend/config/db.js';
import {
  transitionScheduledStarts,
  autoArchiveResolvedInterruptions,
} from './backend/services/interruptionLifecycle.js';
import { pollB2BInboundOnce } from './backend/services/b2bInboundImapPoll.js';
import { requireApiSession } from './backend/middleware/requireApiSession.js';

dotenv.config();

process.env.TZ = 'Asia/Manila';

const app = express();
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

// 2. Middleware (The Guards)
app.use(cors(corsOptions));
app.use(express.json());

/** Uptime / load balancer — no DB (Render health checks). Must be registered before the API session gate. */
app.get('/api/health', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ ok: true, service: 'aleco-pis-api', ts: new Date().toISOString() });
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
app.listen(PORT, '0.0.0.0', () => {
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
});