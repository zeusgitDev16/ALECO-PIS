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
            // High-performance streaming fetch: Avoids n+1 sequential queries causing UI lockups.
            // Grabs the last 15 messages instantly over a single streaming socket using sequence numbers
            const status = await client.status('INBOX', { messages: true });
            if (status.messages > 0) {
                const startSeq = Math.max(1, status.messages - 14); // 15 most recent
                const seqRange = `${startSeq}:*`;
                for await (const msg of client.fetch(seqRange, { source: true, envelope: true, uid: true })) {
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

                    const fromAddr = env.from?.[0]
                        ? `${env.from[0].mailbox || ''}@${env.from[0].host || ''}`.replace(/^@|@$/g, '')
                        : '';
                    const subject = env.subject || '';
                    const bodyText = extractBodySnippet(source);
                    const phNow = nowPhilippineForMysql();

                    // Advanced linking: Fallback to crawling the thread references if inReplyTo is swallowed
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
            } // end if (status.messages > 0)
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
