import { ImapFlow } from 'imapflow';
import pool from '../config/db.js';
import { nowPhilippineForMysql } from '../utils/dateTimeUtils.js';
import { recordB2BMailNotification, B2B_MAIL_EVENT } from '../utils/adminNotifications.js';

// ─── Utilities ───────────────────────────────────────────────────────────────

function normMessageId(s) {
    return String(s || '').replace(/[<>]/g, '').trim().toLowerCase();
}

/** Best-effort single-line header extraction from raw RFC822 */
function extractHeaderBlock(source, name) {
    const re = new RegExp(`^${name}:\\s*(.+?)(?:\\r?\\n(?![\\t ]))`, 'ims');
    const m = source.match(re);
    return m ? m[1].replace(/\r?\n[\t ]+/g, ' ').trim() : '';
}

function decodeQP(str) {
    return str
        .replace(/=\r?\n/g, '')
        .replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function stripQuotedReply(text) {
    const idx = text.search(/\r?\nOn\s[^\n]+wrote:\s*\r?\n/i);
    if (idx !== -1) text = text.slice(0, idx);
    return text.split(/\r?\n/).filter((l) => !l.startsWith('>')).join('\n').trim();
}

function extractBodySnippet(source) {
    const headerEnd = source.search(/\r?\n\r?\n/);
    if (headerEnd === -1) return '';

    // Multipart: extract the text/plain part
    const bMatch = source.match(/boundary="?([^\s";]+)"?/i);
    if (bMatch) {
        const fence = '--' + bMatch[1];
        const parts = source.split(fence);
        for (const part of parts) {
            if (/Content-Type:\s*text\/plain/i.test(part)) {
                const bodyStart = part.search(/\n\s*\n/);
                if (bodyStart === -1) continue;
                let text = part.slice(bodyStart).trim();
                if (/Content-Transfer-Encoding:\s*quoted-printable/i.test(part)) text = decodeQP(text);
                return stripQuotedReply(text).slice(0, 20000);
            }
        }
    }

    // Non-multipart fallback
    let text = source.slice(headerEnd).trim();
    if (/Content-Transfer-Encoding:\s*quoted-printable/i.test(source.slice(0, headerEnd))) {
        text = decodeQP(text);
    }
    return stripQuotedReply(text).slice(0, 20000);
}

/**
 * Fix 3 — Robust international reply-prefix normalization.
 * Strips stacked combinations of localized prefixes before comparing subjects.
 * Covered locales: EN (Re/Fwd/FW), DE (AW/WG), NL (Antw/Doorst), SE/NO/DK (Sv/VS/SV/Svar/FS),
 * FR (Réf/Ref/Rép/TR), PT (Res), TR (Ynt), PL (Odp), and numeric bracket tags like [2].
 */
function normSubject(raw) {
    return String(raw || '')
        .replace(
            /^(\s*(re|r|aw|wg|antw|doorst|sv|vs|svar|fs|ref|r\u00e9f|r\u00e9p|tr|res|ynt|odp|fw|fwd)\s*(\[\d+\])?\s*:\s*)+/gi,
            ''
        )
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

// ─── Linking Strategies ──────────────────────────────────────────────────────

/**
 * Fix 1 (inbound side) — Parse the ALECO synthetic thread anchor from the
 * References header of an incoming reply.
 * Pattern written by outbound: <b2b-msg-{msgId}-rcpt-{recipId}@aleco.ph>
 * Gmail preserves the References chain through its relay; recipient clients
 * copy it verbatim into replies, so this always survives the round-trip.
 */
async function linkByAlecoRef(referencesRaw) {
    const refs = String(referencesRaw || '');
    if (!refs) return { linked_message_id: null, linked_recipient_id: null };
    // Collect every ALECO anchor in the chain; walk newest-to-oldest (rightmost wins)
    const matches = [...refs.matchAll(/<b2b-msg-(\d+)-rcpt-(\d+)@[^>]+>/gi)];
    for (let i = matches.length - 1; i >= 0; i--) {
        const msgId = Number(matches[i][1]);
        const rcptId = Number(matches[i][2]);
        if (!msgId || !rcptId) continue;
        const [rows] = await pool.execute(
            `SELECT id, message_id FROM aleco_b2b_message_recipients
             WHERE id = ? AND message_id = ? LIMIT 1`,
            [rcptId, msgId]
        );
        if (rows?.[0]) return { linked_message_id: rows[0].message_id, linked_recipient_id: rows[0].id };
    }
    return { linked_message_id: null, linked_recipient_id: null };
}

/** Match In-Reply-To against stored provider_message_id (works for non-Gmail transports). */
async function linkRecipientByInReplyTo(inReplyToRaw) {
    const raw = String(inReplyToRaw || '').trim();
    if (!raw) return { linked_message_id: null, linked_recipient_id: null };
    const needle = normMessageId(raw);
    if (!needle) return { linked_message_id: null, linked_recipient_id: null };
    const [recRows] = await pool.execute(
        `SELECT id, message_id FROM aleco_b2b_message_recipients
         WHERE provider_message_id IS NOT NULL AND TRIM(provider_message_id) != ''
         AND (
           LOWER(REPLACE(REPLACE(TRIM(provider_message_id), '<', ''), '>', '')) = ?
           OR TRIM(provider_message_id) = ?
           OR TRIM(provider_message_id) = ?
         )
         LIMIT 1`,
        [needle, raw, `<${needle}>`]
    );
    const r = recRows?.[0];
    if (!r) return { linked_message_id: null, linked_recipient_id: null };
    return { linked_message_id: r.message_id, linked_recipient_id: r.id };
}

/**
 * Fix 3 (applied) — Subject match using normSubject() for international prefixes.
 * Tries precise (subject + sender email) first, falls back to subject-only.
 */
async function linkRecipientBySubject(subjectRaw, fromEmail) {
    const cleanSubject = normSubject(subjectRaw);
    if (!cleanSubject) return { linked_message_id: null, linked_recipient_id: null };
    if (fromEmail && String(fromEmail).includes('@')) {
        const [rows] = await pool.execute(
            `SELECT r.id, r.message_id
             FROM aleco_b2b_message_recipients r
             JOIN aleco_b2b_messages m ON m.id = r.message_id
             WHERE LOWER(TRIM(m.subject)) = ?
               AND LOWER(TRIM(r.email_snapshot)) = LOWER(TRIM(?))
             ORDER BY r.id DESC LIMIT 1`,
            [cleanSubject, fromEmail]
        );
        if (rows?.[0]) return { linked_message_id: rows[0].message_id, linked_recipient_id: rows[0].id };
    }
    const [rows2] = await pool.execute(
        `SELECT r.id, r.message_id
         FROM aleco_b2b_message_recipients r
         JOIN aleco_b2b_messages m ON m.id = r.message_id
         WHERE LOWER(TRIM(m.subject)) = ?
         ORDER BY r.id DESC LIMIT 1`,
        [cleanSubject]
    );
    if (rows2?.[0]) return { linked_message_id: rows2[0].message_id, linked_recipient_id: rows2[0].id };
    return { linked_message_id: null, linked_recipient_id: null };
}

/**
 * Fix 4 — Fuzzy last-resort match.
 * Combines recipient email + normalized subject, constrained to messages sent
 * within the last 7 days to avoid false positives on recurring subjects.
 * Only fires when all precise strategies fail.
 */
async function linkByFuzzyMatch(subjectRaw, fromEmail) {
    const cleanSubject = normSubject(subjectRaw);
    if (!cleanSubject || !fromEmail || !String(fromEmail).includes('@')) {
        return { linked_message_id: null, linked_recipient_id: null };
    }
    const [rows] = await pool.execute(
        `SELECT r.id, r.message_id
         FROM aleco_b2b_message_recipients r
         JOIN aleco_b2b_messages m ON m.id = r.message_id
         WHERE LOWER(TRIM(r.email_snapshot)) = LOWER(TRIM(?))
           AND LOWER(TRIM(m.subject)) = ?
           AND m.sent_at IS NOT NULL
           AND m.sent_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
         ORDER BY r.id DESC LIMIT 1`,
        [fromEmail, cleanSubject]
    );
    if (rows?.[0]) return { linked_message_id: rows[0].message_id, linked_recipient_id: rows[0].id };
    return { linked_message_id: null, linked_recipient_id: null };
}

// ─── Fix 2: UID cursor sync state ────────────────────────────────────────────
// Replaces the \Seen-flag approach. The poller stores the highest UID it has
// processed in MySQL and fetches only UID > lastUid on each run.
// This is immune to Gmail read/unread flag changes made by filters or humans.

const SYNC_TABLE = 'aleco_b2b_sync_state';

async function ensureSyncTable() {
    await pool.execute(
        `CREATE TABLE IF NOT EXISTS ${SYNC_TABLE} (
            key_name   VARCHAR(100) NOT NULL,
            key_value  VARCHAR(255) NOT NULL DEFAULT '',
            updated_at DATETIME     NOT NULL,
            PRIMARY KEY (key_name)
        )`
    );
}

async function getLastUid(mailboxKey) {
    try {
        const [rows] = await pool.execute(
            `SELECT key_value FROM ${SYNC_TABLE} WHERE key_name = ? LIMIT 1`,
            [`imap_last_uid::${mailboxKey}`]
        );
        const v = Number(rows?.[0]?.key_value ?? 0);
        return Number.isFinite(v) && v > 0 ? v : 0;
    } catch {
        return 0; // table might not exist yet on first run before ensureSyncTable
    }
}

async function setLastUid(mailboxKey, uid) {
    const phNow = nowPhilippineForMysql();
    await pool.execute(
        `INSERT INTO ${SYNC_TABLE} (key_name, key_value, updated_at) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE key_value = VALUES(key_value), updated_at = VALUES(updated_at)`,
        [`imap_last_uid::${mailboxKey}`, String(uid), phNow]
    );
}

// ─── Main Poll ────────────────────────────────────────────────────────────────

let _polling = false;

/**
 * Fix 2 — Poll INBOX using UID > lastUid instead of \Seen flag.
 * Full 5-step linking chain applied to each incoming message.
 * Guarded: only one poll runs at a time. Concurrent calls return immediately
 * to prevent Gmail from throttling/blocking the IMAP account.
 */
export async function pollB2BInboundOnce() {
    if (_polling) {
        console.log('[B2B inbound] Poll already in progress, skipping.');
        return { ran: false, reason: 'already_polling' };
    }
    _polling = true;
    try {
        return await _doPoll();
    } finally {
        _polling = false;
    }
}

async function _doPoll() {
    const host = process.env.B2B_INBOUND_IMAP_HOST || 'imap.gmail.com';
    const port = Number(process.env.B2B_INBOUND_IMAP_PORT || 993);
    const user =
        process.env.B2B_INBOUND_IMAP_USER ||
        process.env.B2B_MAIL_USER ||
        process.env.EMAIL_USER;
    const pass =
        process.env.B2B_INBOUND_IMAP_PASS ||
        process.env.B2B_MAIL_PASS ||
        process.env.EMAIL_PASS;
    if (!user || !pass) {
        console.warn('[B2B inbound] Missing IMAP user/pass; skip poll.');
        return { ran: false, reason: 'no_credentials' };
    }

    try { await ensureSyncTable(); } catch (e) {
        console.warn('[B2B inbound] sync table init failed (falling back to seen-flag mode):', e?.message);
    }
    const mailboxKey = `${user}::INBOX`;
    const lastUid = await getLastUid(mailboxKey);

    const imapDebug = process.env.B2B_IMAP_DEBUG === 'true';
    const client = new ImapFlow({
        host,
        port,
        secure: String(process.env.B2B_INBOUND_IMAP_TLS || 'true').toLowerCase() !== 'false',
        auth: { user, pass },
        logger: imapDebug ? console : false,
        connectionTimeout: 10000,
        greetingTimeout: 5000,
        socketTimeout: 15000,
    });

    client.on('error', (err) => {
        console.warn(`[B2B inbound] ImapFlow error (${err?.code || 'Unknown'}):`, err?.message || err);
    });

    let inserted = 0;
    let maxUidSeen = lastUid;

    try {
        const t0 = Date.now();
        await client.connect();
        console.log(`[B2B inbound] IMAP connect: ${Date.now() - t0}ms`);

        const t1 = Date.now();
        const lock = await client.getMailboxLock('INBOX');
        console.log(`[B2B inbound] Mailbox lock: ${Date.now() - t1}ms (uidNext=${client.mailbox?.uidNext})`);
        try {
            // Unified search: bootstrap (first run) uses seen:false to capture any
            // messages that arrived during the restart window, then pins the cursor
            // to UIDNEXT-1 so future polls never re-scan the full mailbox history.
            // Normal runs use UID > lastUid, immune to Gmail read/unread flag changes.
            const isBootstrap = lastUid === 0;
            let uidsToProcess;
            const t2 = Date.now();
            if (isBootstrap) {
                uidsToProcess = (await client.search({ seen: false }, { uid: true })) || [];
            } else {
                // Rolling 7-day SINCE window keeps the search result small.
                const since = new Date();
                since.setDate(since.getDate() - 7);
                const raw = (await client.search({ since }, { uid: true })) || [];
                uidsToProcess = raw.filter((u) => u > lastUid);
            }
            console.log(`[B2B inbound] Search: ${Date.now() - t2}ms, found ${uidsToProcess.length} new UIDs (lastUid=${lastUid})`);

            // Auto-heal: if massively behind, jump cursor forward and skip this run
            if (!isBootstrap && uidsToProcess.length > 500) {
                const jumpTo = (client.mailbox?.uidNext ?? 1) - 1;
                console.warn(`[B2B inbound] ${uidsToProcess.length} UIDs behind — advancing cursor to ${jumpTo}`);
                try { await setLastUid(mailboxKey, jumpTo); } catch {}
                uidsToProcess = [];
            }

            // Bootstrap: pick newest 50 so we catch the most recent missed messages.
            // Normal: pick oldest 50 so the cursor advances incrementally.
            const batch = isBootstrap ? uidsToProcess.slice(-50) : uidsToProcess.slice(0, 50);

            if (batch.length > 0) {

                for await (const msg of client.fetch(batch, { source: true, envelope: true, uid: true }, { uid: true })) {
                    if (!msg || msg.uid <= lastUid) continue;

                    const sourceBuf = msg.source;
                    const source = sourceBuf ? sourceBuf.toString('utf8') : '';
                    const env = msg.envelope || {};

                    let providerId = env.messageId || extractHeaderBlock(source, 'Message-ID');
                    if (!providerId) providerId = `imap-uid-${msg.uid}@${host}`;

                    const inReplyTo = env.inReplyTo || extractHeaderBlock(source, 'In-Reply-To');
                    const references = extractHeaderBlock(source, 'References');

                    const fromAddr = (() => {
                        const ef = env.from?.[0];
                        if (ef?.address) return ef.address;
                        if (ef?.mailbox && ef?.host) return `${ef.mailbox}@${ef.host}`;
                        const rawFrom = extractHeaderBlock(source, 'From');
                        if (rawFrom) {
                            const angleM = rawFrom.match(/<([^>]+@[^>]+)>/);
                            if (angleM) return angleM[1].trim();
                            const plainM = rawFrom.match(/[\w.+\-]+@[\w.\-]+\.\w+/);
                            if (plainM) return plainM[0].trim();
                        }
                        return '';
                    })();

                    const subject = env.subject || '';
                    const bodyText = extractBodySnippet(source);
                    const phNow = nowPhilippineForMysql();

                    // 5-step linking chain (priority order):
                    // 1. ALECO synthetic anchor in References  (Fix 1 — highest confidence)
                    // 2. In-Reply-To vs stored provider_message_id
                    // 3. Walk every References entry vs stored provider_message_id
                    // 4. Normalized subject + sender exact match  (Fix 3)
                    // 5. Fuzzy: email + subject within 7-day window  (Fix 4)
                    let link = await linkByAlecoRef(references);
                    if (!link.linked_message_id && inReplyTo) {
                        link = await linkRecipientByInReplyTo(inReplyTo);
                    }
                    if (!link.linked_message_id && references) {
                        const refIds = references.match(/<[^>]+>/g);
                        if (refIds) {
                            for (let i = refIds.length - 1; i >= 0; i--) {
                                link = await linkRecipientByInReplyTo(refIds[i]);
                                if (link.linked_message_id) break;
                            }
                        }
                    }
                    if (!link.linked_message_id && subject) {
                        link = await linkRecipientBySubject(subject, fromAddr);
                    }
                    if (!link.linked_message_id && subject && fromAddr) {
                        link = await linkByFuzzyMatch(subject, fromAddr);
                    }

                    try {
                        await pool.execute(
                            `INSERT INTO aleco_b2b_inbound_messages
                             (provider_message_id, from_email, subject, body_text, in_reply_to, references_header,
                              linked_message_id, linked_recipient_id, raw_headers, received_at)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [
                                providerId.slice(0, 500),
                                (fromAddr || 'unknown').slice(0, 255),
                                String(subject).slice(0, 500),
                                bodyText || null,
                                inReplyTo ? inReplyTo.slice(0, 500) : null,
                                references || null,
                                link.linked_message_id,
                                link.linked_recipient_id,
                                source.slice(0, 50000) || null,
                                phNow,
                            ]
                        );
                        inserted += 1;
                        if (link.linked_message_id) {
                            await recordB2BMailNotification(pool, {
                                eventType: B2B_MAIL_EVENT.REPLY_FETCHED,
                                subjectEmail: (fromAddr || 'unknown').slice(0, 255),
                                subjectName: String(subject || '').slice(0, 200) || null,
                                detail: `Linked to message #${link.linked_message_id}`,
                                actorEmail: null,
                            });
                        }
                    } catch (e) {
                        if (e?.code !== 'ER_DUP_ENTRY') {
                            console.error('[B2B inbound] insert error:', e?.message || e);
                        }
                    }

                    if (msg.uid > maxUidSeen) maxUidSeen = msg.uid;
                }
            }

            // Advance cursor (non-fatal — if sync table is unavailable, next poll retries)
            try {
                if (isBootstrap) {
                    const bootUid = Math.max(maxUidSeen, (client.mailbox?.uidNext ?? 1) - 1);
                    if (bootUid > 0) await setLastUid(mailboxKey, bootUid);
                } else if (maxUidSeen > lastUid) {
                    await setLastUid(mailboxKey, maxUidSeen);
                }
            } catch (e) {
                console.warn('[B2B inbound] cursor advance failed:', e?.message);
            }
        } finally {
            lock.release();
        }
    } catch (e) {
        console.error('[B2B inbound] IMAP poll error:', e?.message || e);
        return { ran: true, error: e?.message || String(e), inserted };
    } finally {
        try { await client.logout(); } catch { /* ignore */ }
    }

    return { ran: true, inserted };
}

/**
 * Retroactively re-link inbound messages with no linked_message_id.
 * Uses 2 batch DB queries instead of up to 1000 individual ones:
 *   1. SELECT all unlinked inbound rows (max 200)
 *   2. SELECT all sent outbound recipients with their messages (JOIN)
 * Matching is done entirely in memory using Maps, then only matched
 * rows get an UPDATE. For 837 unlinked rows + 5 recipients this runs
 * in ~160ms instead of ~78 seconds.
 */
export async function relinkUnlinkedInbound() {
    const [inboundRows] = await pool.execute(
        `SELECT id, from_email, subject, in_reply_to, references_header
         FROM aleco_b2b_inbound_messages
         WHERE linked_message_id IS NULL
         ORDER BY id DESC LIMIT 200`
    );
    if (!inboundRows.length) return { relinked: 0 };

    const [recipients] = await pool.execute(
        `SELECT r.id, r.message_id, r.provider_message_id, r.email_snapshot, m.subject, m.sent_at
         FROM aleco_b2b_message_recipients r
         JOIN aleco_b2b_messages m ON m.id = r.message_id
         WHERE r.send_status = 'sent'
           AND r.provider_message_id IS NOT NULL
           AND r.provider_message_id != ''`
    );
    if (!recipients.length) return { relinked: 0 };

    // Build O(1) lookup maps from outbound recipients
    const byProvId = new Map();
    for (const r of recipients) {
        const norm = normMessageId(r.provider_message_id);
        if (norm && !byProvId.has(norm)) byProvId.set(norm, r);
        const raw = String(r.provider_message_id || '').trim();
        if (raw && !byProvId.has(raw)) byProvId.set(raw, r);
    }

    const bySubjectEmail = new Map();
    const bySubjectOnly = new Map();
    const sevenDayMs = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    for (const r of recipients) {
        const subj = normSubject(r.subject);
        if (!subj) continue;
        const email = String(r.email_snapshot || '').trim().toLowerCase();
        const seKey = `${email}::${subj}`;
        if (!bySubjectEmail.has(seKey)) bySubjectEmail.set(seKey, r);
        if (!bySubjectOnly.has(subj)) bySubjectOnly.set(subj, r);
        if (r.sent_at && (now - new Date(r.sent_at).getTime()) <= sevenDayMs) {
            const fuzzyKey = `fuzzy::${seKey}`;
            if (!bySubjectEmail.has(fuzzyKey)) bySubjectEmail.set(fuzzyKey, r);
        }
    }

    let relinked = 0;
    for (const row of inboundRows) {
        let matched = null;

        // 1. ALECO synthetic anchor in References
        if (!matched && row.references_header) {
            const anchors = [...row.references_header.matchAll(/<b2b-msg-(\d+)-rcpt-(\d+)@[^>]+>/gi)];
            for (let i = anchors.length - 1; i >= 0; i--) {
                const msgId = Number(anchors[i][1]), rcptId = Number(anchors[i][2]);
                const r = recipients.find((r) => r.message_id === msgId && r.id === rcptId);
                if (r) { matched = r; break; }
            }
        }

        // 2. In-Reply-To vs stored provider_message_id
        if (!matched && row.in_reply_to) {
            const needle = normMessageId(row.in_reply_to);
            matched = byProvId.get(needle) || byProvId.get(String(row.in_reply_to).trim()) || null;
        }

        // 3. Walk References chain
        if (!matched && row.references_header) {
            const refIds = [...row.references_header.matchAll(/<([^>]+)>/g)]
                .map((m) => m[1])
                .reverse();
            for (const ref of refIds) {
                matched = byProvId.get(normMessageId(`<${ref}>`)) || byProvId.get(`<${ref}>`) || null;
                if (matched) break;
            }
        }

        // 4. Normalized subject + sender
        if (!matched && row.subject) {
            const subj = normSubject(row.subject);
            const email = String(row.from_email || '').trim().toLowerCase();
            if (email) matched = bySubjectEmail.get(`${email}::${subj}`) || null;
            if (!matched) matched = bySubjectOnly.get(subj) || null;
        }

        // 5. Fuzzy: email + subject within 7-day window
        if (!matched && row.subject && row.from_email) {
            const subj = normSubject(row.subject);
            const email = String(row.from_email || '').trim().toLowerCase();
            matched = bySubjectEmail.get(`fuzzy::${email}::${subj}`) || null;
        }

        if (matched) {
            await pool.execute(
                `UPDATE aleco_b2b_inbound_messages
                 SET linked_message_id = ?, linked_recipient_id = ?
                 WHERE id = ?`,
                [matched.message_id, matched.id, row.id]
            );
            relinked++;
        }
    }
    return { relinked };
}

// ─── On-Demand Targeted Fetch ─────────────────────────────────────────────────

/**
 * Searches IMAP specifically for replies to a single outbound B2B message.
 * Uses FROM <recipient> + SINCE criteria per recipient — typically returns
 * 0-5 UIDs instead of the full inbox. Called by the "Refresh Replies" button.
 */
export async function fetchTargetedReplies(messageId) {
    const [[msg]] = await pool.execute(
        'SELECT id, subject FROM aleco_b2b_messages WHERE id = ? LIMIT 1',
        [messageId]
    );
    if (!msg) return { found: 0, reason: 'message_not_found' };

    const [recipients] = await pool.execute(
        `SELECT DISTINCT email_snapshot FROM aleco_b2b_message_recipients
         WHERE message_id = ? AND send_status = 'sent' AND email_snapshot IS NOT NULL`,
        [messageId]
    );
    if (!recipients.length) return { found: 0, reason: 'no_sent_recipients' };

    const host = process.env.B2B_INBOUND_IMAP_HOST || 'imap.gmail.com';
    const port = Number(process.env.B2B_INBOUND_IMAP_PORT || 993);
    const user =
        process.env.B2B_INBOUND_IMAP_USER ||
        process.env.B2B_MAIL_USER ||
        process.env.EMAIL_USER;
    const pass =
        process.env.B2B_INBOUND_IMAP_PASS ||
        process.env.B2B_MAIL_PASS ||
        process.env.EMAIL_PASS;
    if (!user || !pass) return { found: 0, reason: 'no_credentials' };

    const client = new ImapFlow({
        host,
        port,
        secure: String(process.env.B2B_INBOUND_IMAP_TLS || 'true').toLowerCase() !== 'false',
        auth: { user, pass },
        logger: false,
        connectionTimeout: 10000,
        greetingTimeout: 5000,
        socketTimeout: 15000,
    });

    let found = 0;
    const since = new Date();
    since.setDate(since.getDate() - 30);

    try {
        const t0 = Date.now();
        await client.connect();
        const lock = await client.getMailboxLock('INBOX');
        try {
            for (const r of recipients) {
                const uids = (await client.search({
                    from: r.email_snapshot,
                    since,
                }, { uid: true })) || [];
                console.log(`[B2B targeted] FROM:${r.email_snapshot} → ${uids.length} UIDs`);
                if (!uids.length) continue;

                // Newest 20 per recipient is plenty
                const batch = uids.slice(-20);
                for await (const imapMsg of client.fetch(batch, {
                    source: true, envelope: true, uid: true,
                }, { uid: true })) {
                    if (!imapMsg) continue;

                    const sourceBuf = imapMsg.source;
                    const source = sourceBuf ? sourceBuf.toString('utf8') : '';
                    const env = imapMsg.envelope || {};

                    let providerId = env.messageId || extractHeaderBlock(source, 'Message-ID');
                    if (!providerId) providerId = `imap-uid-${imapMsg.uid}@${host}`;

                    const inReplyTo = env.inReplyTo || extractHeaderBlock(source, 'In-Reply-To');
                    const references = extractHeaderBlock(source, 'References');

                    const fromAddr = (() => {
                        const ef = env.from?.[0];
                        if (ef?.address) return ef.address;
                        if (ef?.mailbox && ef?.host) return `${ef.mailbox}@${ef.host}`;
                        const rawFrom = extractHeaderBlock(source, 'From');
                        if (rawFrom) {
                            const angleM = rawFrom.match(/<([^>]+@[^>]+)>/);
                            if (angleM) return angleM[1].trim();
                            const plainM = rawFrom.match(/[\w.+\-]+@[\w.\-]+\.\w+/);
                            if (plainM) return plainM[0].trim();
                        }
                        return '';
                    })();

                    const subject = env.subject || '';
                    const bodyText = extractBodySnippet(source);
                    const phNow = nowPhilippineForMysql();

                    // 5-step linking chain (same as background poller)
                    let link = await linkByAlecoRef(references);
                    if (!link.linked_message_id && inReplyTo) {
                        link = await linkRecipientByInReplyTo(inReplyTo);
                    }
                    if (!link.linked_message_id && references) {
                        const refIds = references.match(/<[^>]+>/g);
                        if (refIds) {
                            for (let i = refIds.length - 1; i >= 0; i--) {
                                link = await linkRecipientByInReplyTo(refIds[i]);
                                if (link.linked_message_id) break;
                            }
                        }
                    }
                    if (!link.linked_message_id && subject) {
                        link = await linkRecipientBySubject(subject, fromAddr);
                    }
                    if (!link.linked_message_id && subject && fromAddr) {
                        link = await linkByFuzzyMatch(subject, fromAddr);
                    }

                    try {
                        await pool.execute(
                            `INSERT INTO aleco_b2b_inbound_messages
                             (provider_message_id, from_email, subject, body_text, in_reply_to, references_header,
                              linked_message_id, linked_recipient_id, raw_headers, received_at)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [
                                providerId.slice(0, 500),
                                (fromAddr || 'unknown').slice(0, 255),
                                String(subject).slice(0, 500),
                                bodyText || null,
                                inReplyTo ? inReplyTo.slice(0, 500) : null,
                                references || null,
                                link.linked_message_id,
                                link.linked_recipient_id,
                                source.slice(0, 50000) || null,
                                phNow,
                            ]
                        );
                        found++;
                        if (link.linked_message_id) {
                            await recordB2BMailNotification(pool, {
                                eventType: B2B_MAIL_EVENT.REPLY_FETCHED,
                                subjectEmail: (fromAddr || 'unknown').slice(0, 255),
                                subjectName: String(subject || '').slice(0, 200) || null,
                                detail: `Linked to message #${link.linked_message_id}`,
                                actorEmail: null,
                            });
                        }
                    } catch (e) {
                        if (e?.code !== 'ER_DUP_ENTRY') {
                            console.error('[B2B targeted] insert error:', e?.message || e);
                        }
                    }
                }
            }
        } finally {
            lock.release();
        }
        console.log(`[B2B targeted] Done in ${Date.now() - t0}ms, inserted ${found} new replies`);
    } catch (e) {
        console.error('[B2B targeted] IMAP error:', e?.message || e);
    } finally {
        try { await client.logout(); } catch { /* ignore */ }
    }

    return { found };
}
