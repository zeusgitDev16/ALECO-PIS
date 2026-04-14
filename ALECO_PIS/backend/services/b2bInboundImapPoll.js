import { ImapFlow } from 'imapflow';
import pool from '../config/db.js';
import { nowPhilippineForMysql } from '../utils/dateTimeUtils.js';

function normMessageId(s) {
    return String(s || '')
        .replace(/[<>]/g, '')
        .trim()
        .toLowerCase();
}

/** Best-effort single-line header extraction from raw RFC822 */
function extractHeaderBlock(source, name) {
    const re = new RegExp(`^${name}:\\s*(.+?)(?:\\r?\\n(?![\\t ]))`, 'ims');
    const m = source.match(re);
    return m ? m[1].replace(/\r?\n[\t ]+/g, ' ').trim() : '';
}

function extractBodySnippet(source) {
    const idx = source.search(/\r?\n\r?\n/);
    if (idx === -1) return '';
    return String(source.slice(idx)).slice(0, 20000).trim();
}

async function linkRecipientBySubject(subjectRaw, fromEmail) {
    const cleanSubject = String(subjectRaw || '').replace(/^(re:\s*)+/i, '').trim();
    if (!cleanSubject) return { linked_message_id: null, linked_recipient_id: null };
    // Precise: subject + sender email matches a known recipient
    if (fromEmail && String(fromEmail).includes('@')) {
        const [rows] = await pool.execute(
            `SELECT r.id, r.message_id
             FROM aleco_b2b_message_recipients r
             JOIN aleco_b2b_messages m ON m.id = r.message_id
             WHERE LOWER(TRIM(m.subject)) = LOWER(TRIM(?))
               AND LOWER(TRIM(r.email_snapshot)) = LOWER(TRIM(?))
             ORDER BY r.id DESC LIMIT 1`,
            [cleanSubject, fromEmail]
        );
        if (rows?.[0]) return { linked_message_id: rows[0].message_id, linked_recipient_id: rows[0].id };
    }
    // Less precise: subject only — only link if a single outbound message has this subject
    const [rows2] = await pool.execute(
        `SELECT r.id, r.message_id
         FROM aleco_b2b_message_recipients r
         JOIN aleco_b2b_messages m ON m.id = r.message_id
         WHERE LOWER(TRIM(m.subject)) = LOWER(TRIM(?))
         ORDER BY r.id DESC LIMIT 1`,
        [cleanSubject]
    );
    if (rows2?.[0]) return { linked_message_id: rows2[0].message_id, linked_recipient_id: rows2[0].id };
    return { linked_message_id: null, linked_recipient_id: null };
}

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
 * Poll INBOX for unseen messages and store in aleco_b2b_inbound_messages.
 * Enable with B2B_INBOUND_IMAP_ENABLED=true and IMAP host/user/pass envs.
 */
export async function pollB2BInboundOnce() {
    // Note: removed B2B_INBOUND_IMAP_ENABLED requirement. If the system has 
    // an email password configured, we automatically enable inbound tracking.

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

    const client = new ImapFlow({
        host,
        port,
        secure: String(process.env.B2B_INBOUND_IMAP_TLS || 'true').toLowerCase() !== 'false',
        auth: { user, pass },
        logger: false,
        connectionTimeout: 12000,
        greetingTimeout: 8000,
        socketTimeout: 20000,
    });

    // Prevent background socket drops or ETIMEOUTs from crashing the Node.js server
    client.on('error', (err) => {
        console.warn(`[B2B inbound] ImapFlow background connection error (${err?.code || 'Unknown'}):`, err?.message || err);
    });

    let inserted = 0;
    try {
        await client.connect();
        const lock = await client.getMailboxLock('INBOX');
        try {
            // Fetch only UNSEEN messages so each email is processed exactly once.
            // Messages are marked \Seen after insert; ER_DUP_ENTRY acts as a safety net.
            const unseenUids = await client.search({ seen: false }, { uid: true });
            if (unseenUids && unseenUids.length > 0) {
                const batch = unseenUids.slice(-50); // cap at 50 most recent per poll
                for await (const msg of client.fetch(batch, { source: true, envelope: true, uid: true }, { uid: true })) {
                    if (!msg) continue;

                    const sourceBuf = msg.source;
                    const source = sourceBuf ? sourceBuf.toString('utf8') : '';
                    const env = msg.envelope || {};

                    // Use robust IMAP envelope parser instead of raw regex
                    let providerId = env.messageId || extractHeaderBlock(source, 'Message-ID');
                    if (!providerId) {
                        providerId = `imap-uid-${msg.uid}@${host}`;
                    }

                    let inReplyTo = env.inReplyTo || extractHeaderBlock(source, 'In-Reply-To');
                    let references = extractHeaderBlock(source, 'References');

                    const fromAddr = (() => {
                        const ef = env.from?.[0];
                        // ImapFlow v2+ exposes the full address directly on .address
                        if (ef?.address) return ef.address;
                        // Reconstruct from parts as fallback
                        if (ef?.mailbox && ef?.host) return `${ef.mailbox}@${ef.host}`;
                        // Last resort: parse the raw From: header
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

                    // Linking chain: In-Reply-To → References thread walk → subject+sender fallback
                    let link = await linkRecipientByInReplyTo(inReplyTo);
                    if (!link.linked_message_id && references) {
                        const refs = references.match(/<[^>]+>/g);
                        if (refs && refs.length > 0) {
                            for (let i = refs.length - 1; i >= 0; i--) {
                                link = await linkRecipientByInReplyTo(refs[i]);
                                if (link.linked_message_id) break;
                            }
                        }
                    }
                    if (!link.linked_message_id && subject) {
                        link = await linkRecipientBySubject(subject, fromAddr);
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
                    } catch (e) {
                        if (e?.code === 'ER_DUP_ENTRY') {
                            /* already stored */
                        } else {
                            console.error('[B2B inbound] insert error:', e?.message || e);
                        }
                    }

                    try {
                        await client.messageFlagsAdd(String(msg.uid), ['\\Seen'], { uid: true });
                    } catch (e) {
                        console.warn('[B2B inbound] mark seen failed:', e?.message || e);
                    }
                } // end loop
            } // end if (unseenUids.length > 0)
        } finally {
            lock.release();
        }
    } catch (e) {
        console.error('[B2B inbound] IMAP poll error:', e?.message || e);
        return { ran: true, error: e?.message || String(e), inserted };
    } finally {
        try {
            await client.logout();
        } catch {
            /* ignore */
        }
    }

    return { ran: true, inserted };
}

/**
 * Retroactively attempt to link inbound messages that have no linked_message_id.
 * Tries In-Reply-To → References → subject+sender fallback.
 * Called by the refresh endpoint so previously unmatched rows get linked after new messages arrive.
 */
export async function relinkUnlinkedInbound() {
    const [rows] = await pool.execute(
        `SELECT id, from_email, subject, in_reply_to, references_header
         FROM aleco_b2b_inbound_messages
         WHERE linked_message_id IS NULL
         ORDER BY id DESC LIMIT 200`
    );
    let relinked = 0;
    for (const row of rows) {
        let link = await linkRecipientByInReplyTo(row.in_reply_to);
        if (!link.linked_message_id && row.references_header) {
            const refs = row.references_header.match(/<[^>]+>/g);
            if (refs) {
                for (let i = refs.length - 1; i >= 0; i--) {
                    link = await linkRecipientByInReplyTo(refs[i]);
                    if (link.linked_message_id) break;
                }
            }
        }
        if (!link.linked_message_id && row.subject) {
            link = await linkRecipientBySubject(row.subject, row.from_email);
        }
        if (link.linked_message_id) {
            await pool.execute(
                `UPDATE aleco_b2b_inbound_messages
                 SET linked_message_id = ?, linked_recipient_id = ?
                 WHERE id = ?`,
                [link.linked_message_id, link.linked_recipient_id, row.id]
            );
            relinked += 1;
        }
    }
    return { relinked };
}
