import express from 'express';
import crypto from 'crypto';
import pool from '../config/db.js';
import {
    listContacts,
    upsertContact,
    setContactActive,
    saveDraft,
    sendMessage,
    buildRecipientsForMessage,
    previewRecipientsFromPayload,
} from '../services/b2bMailService.js';
import { nowPhilippineForMysql } from '../utils/dateTimeUtils.js';
import { sendB2BMail } from '../utils/b2bMailProvider.js';
import { pollB2BInboundOnce } from '../services/b2bInboundImapPoll.js';

const router = express.Router();

/** Prefer X-User-Email / X-User-Name headers (admin clients) over body-only actor fields. */
function withActorFromReq(req, body) {
    const b = body && typeof body === 'object' ? { ...body } : {};
    const header = (name) => {
        const v = req.headers[name];
        return typeof v === 'string' && v.trim() ? v.trim() : null;
    };
    if (!b.actorEmail) b.actorEmail = header('x-user-email');
    if (!b.actorName) b.actorName = header('x-user-name');
    return b;
}

function sha256(v) {
    return crypto.createHash('sha256').update(String(v)).digest('hex');
}

function resolveBaseUrl(req) {
    const explicit =
        (process.env.PUBLIC_API_URL || process.env.API_PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '').trim();
    if (explicit) return explicit.replace(/\/$/, '');
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.headers['x-forwarded-host'] || req.get('host');
    return `${proto}://${host}`.replace(/\/$/, '');
}

router.get('/b2b-mail/contacts', async (req, res) => {
    try {
        const rows = await listContacts({
            q: req.query.q || '',
            feederId: req.query.feederId ?? null,
            active: req.query.active ?? null,
        });
        return res.json({ success: true, data: rows });
    } catch (err) {
        console.error('❌ GET /b2b-mail/contacts:', err);
        return res.status(500).json({ success: false, message: 'Failed to load contacts.' });
    }
});

router.post('/b2b-mail/contacts', async (req, res) => {
    try {
        const id = await upsertContact(req.body || {});
        const rows = await listContacts({});
        const contact = rows.find((r) => Number(r.id) === Number(id)) || null;
        return res.status(201).json({ success: true, data: contact });
    } catch (err) {
        if (err instanceof TypeError) return res.status(400).json({ success: false, message: err.message });
        console.error('❌ POST /b2b-mail/contacts:', err);
        return res.status(500).json({ success: false, message: 'Failed to save contact.' });
    }
});

router.put('/b2b-mail/contacts/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ success: false, message: 'Invalid id' });
        await upsertContact({ ...(req.body || {}), id });
        const rows = await listContacts({});
        const contact = rows.find((r) => Number(r.id) === id) || null;
        return res.json({ success: true, data: contact });
    } catch (err) {
        if (err instanceof TypeError) return res.status(400).json({ success: false, message: err.message });
        console.error('❌ PUT /b2b-mail/contacts/:id:', err);
        return res.status(500).json({ success: false, message: 'Failed to update contact.' });
    }
});

router.patch('/b2b-mail/contacts/:id/active', async (req, res) => {
    try {
        const id = Number(req.params.id);
        const active = req.body?.active;
        if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ success: false, message: 'Invalid id' });
        await setContactActive(id, Boolean(active));
        return res.json({ success: true });
    } catch (err) {
        console.error('❌ PATCH /b2b-mail/contacts/:id/active:', err);
        return res.status(500).json({ success: false, message: 'Failed to update contact status.' });
    }
});

router.post('/b2b-mail/contacts/:id/send-verification', async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ success: false, message: 'Invalid id' });
        const [rows] = await pool.execute(
            `SELECT id, contact_name, email, email_verified FROM aleco_b2b_contacts WHERE id = ? LIMIT 1`,
            [id]
        );
        const contact = rows?.[0];
        if (!contact) return res.status(404).json({ success: false, message: 'Contact not found.' });
        if (Number(contact.email_verified) === 1) {
            return res.json({ success: true, data: { alreadyVerified: true } });
        }

        const [recent] = await pool.execute(
            `SELECT created_at
             FROM aleco_b2b_contact_verifications
             WHERE contact_id = ? AND status = 'pending'
             ORDER BY id DESC LIMIT 1`,
            [id]
        );
        if (recent?.[0]?.created_at) {
            const elapsedMs = Date.now() - new Date(recent[0].created_at).getTime();
            if (Number.isFinite(elapsedMs) && elapsedMs < 60 * 1000) {
                return res.status(429).json({ success: false, message: 'Please wait before resending verification.' });
            }
        }

        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = sha256(rawToken);
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const expiresAtMysql = expiresAt.toISOString().slice(0, 19).replace('T', ' ');

        await pool.execute(
            `UPDATE aleco_b2b_contact_verifications
             SET status = 'revoked'
             WHERE contact_id = ? AND status = 'pending'`,
            [id]
        );
        await pool.execute(
            `INSERT INTO aleco_b2b_contact_verifications
             (contact_id, token_hash, status, expires_at, created_at)
             VALUES (?, ?, 'pending', ?, ?)`,
            [id, tokenHash, expiresAtMysql, nowPhilippineForMysql()]
        );

        const verifyUrl = `${resolveBaseUrl(req)}/api/b2b-mail/contacts/verify?token=${encodeURIComponent(rawToken)}`;
        const contactName = String(contact.contact_name || 'Partner');
        await sendB2BMail({
            to: String(contact.email),
            subject: 'ALECO B2B Contact Verification',
            text:
                `Hello ${contactName},\n\n` +
                `Please verify your email for ALECO B2B notifications by clicking this link:\n${verifyUrl}\n\n` +
                `This link expires in 24 hours.\n`,
            html:
                `<div style="font-family: Arial, sans-serif; line-height:1.5;">` +
                `<h3>ALECO B2B Contact Verification</h3>` +
                `<p>Hello ${contactName},</p>` +
                `<p>Please verify your email for ALECO B2B notifications.</p>` +
                `<p><a href="${verifyUrl}" style="display:inline-block;padding:10px 14px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Verify Email</a></p>` +
                `<p style="color:#666;font-size:13px;">This link expires in 24 hours.</p>` +
                `</div>`,
        });

        return res.json({ success: true, data: { sent: true } });
    } catch (err) {
        console.error('❌ POST /b2b-mail/contacts/:id/send-verification:', err);
        return res.status(500).json({ success: false, message: 'Failed to send verification email.' });
    }
});

router.get('/b2b-mail/contacts/verify', async (req, res) => {
    try {
        const token = String(req.query.token || '').trim();
        if (!token) {
            return res.status(400).send('Invalid verification link.');
        }
        const tokenHash = sha256(token);
        const [rows] = await pool.execute(
            `SELECT id, contact_id, status, expires_at
             FROM aleco_b2b_contact_verifications
             WHERE token_hash = ?
             LIMIT 1`,
            [tokenHash]
        );
        const row = rows?.[0];
        if (!row) return res.status(400).send('This verification link is invalid.');
        if (row.status !== 'pending') return res.status(400).send('This verification link was already used.');
        if (new Date(row.expires_at).getTime() < Date.now()) {
            await pool.execute(
                `UPDATE aleco_b2b_contact_verifications SET status = 'expired' WHERE id = ?`,
                [row.id]
            );
            return res.status(400).send('This verification link has expired.');
        }

        const phNow = nowPhilippineForMysql();
        await pool.execute(
            `UPDATE aleco_b2b_contact_verifications
             SET status = 'verified', verified_at = ?
             WHERE id = ?`,
            [phNow, row.id]
        );
        await pool.execute(
            `UPDATE aleco_b2b_contacts
             SET email_verified = 1, verified_at = ?, updated_at = ?
             WHERE id = ?`,
            [phNow, phNow, row.contact_id]
        );
        return res
            .status(200)
            .send('<h2>Email verified successfully.</h2><p>You may now close this tab.</p>');
    } catch (err) {
        console.error('❌ GET /b2b-mail/contacts/verify:', err);
        return res.status(500).send('Verification failed. Please contact ALECO admin.');
    }
});

router.get('/b2b-mail/messages', async (req, res) => {
    try {
        const folder = String(req.query.folder || 'all');
        const q = String(req.query.q || '').trim();
        const where = [];
        const params = [];
        if (folder === 'draft') where.push(`m.status = 'draft'`);
        if (folder === 'sent') where.push(`m.status = 'sent'`);
        if (folder === 'failed') where.push(`m.status = 'failed'`);
        if (folder === 'queued') where.push(`m.status IN ('queued','sending')`);
        if (q) {
            where.push('(m.subject LIKE ? OR m.body_text LIKE ? OR m.created_by_email LIKE ?)');
            const token = `%${q}%`;
            params.push(token, token, token);
        }
        const [rows] = await pool.execute(
            `SELECT
                m.*,
                (SELECT COUNT(*) FROM aleco_b2b_message_recipients r WHERE r.message_id = m.id) AS recipients_count,
                (SELECT COUNT(*) FROM aleco_b2b_message_recipients r WHERE r.message_id = m.id AND r.send_status = 'sent') AS sent_count,
                (SELECT COUNT(*) FROM aleco_b2b_message_recipients r WHERE r.message_id = m.id AND r.send_status = 'failed') AS failed_count
             FROM aleco_b2b_messages m
             ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
             ORDER BY m.updated_at DESC, m.id DESC
             LIMIT 200`,
            params
        );
        return res.json({ success: true, data: rows });
    } catch (err) {
        console.error('❌ GET /b2b-mail/messages:', err);
        return res.status(500).json({ success: false, message: 'Failed to load messages.' });
    }
});

router.get('/b2b-mail/messages/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ success: false, message: 'Invalid id' });
        const [mRows] = await pool.execute('SELECT * FROM aleco_b2b_messages WHERE id = ? LIMIT 1', [id]);
        const message = mRows?.[0];
        if (!message) return res.status(404).json({ success: false, message: 'Message not found.' });
        const [recipients] = await pool.execute(
            `SELECT id, contact_id, email_snapshot, name_snapshot, send_status, provider_message_id, error_message, sent_at
             FROM aleco_b2b_message_recipients WHERE message_id = ? ORDER BY id ASC`,
            [id]
        );
        const [audits] = await pool.execute(
            `SELECT id, actor_email, actor_name, action, details, created_at
             FROM aleco_b2b_mail_audit_logs WHERE message_id = ? ORDER BY id DESC`,
            [id]
        );
        return res.json({ success: true, data: { message, recipients, audits } });
    } catch (err) {
        console.error('❌ GET /b2b-mail/messages/:id:', err);
        return res.status(500).json({ success: false, message: 'Failed to load message detail.' });
    }
});

router.post('/b2b-mail/messages/preview-recipients', async (req, res) => {
    try {
        const list = await previewRecipientsFromPayload(req.body || {});
        return res.json({
            success: true,
            data: {
                count: list.length,
                sample: list.slice(0, 50).map((r) => ({ email: r.email, name: r.contact_name })),
            },
        });
    } catch (err) {
        if (err instanceof TypeError) return res.status(400).json({ success: false, message: err.message });
        console.error('❌ POST /b2b-mail/messages/preview-recipients:', err);
        return res.status(500).json({ success: false, message: 'Failed to preview recipients.' });
    }
});

router.post('/b2b-mail/messages/:id/preview-recipients', async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ success: false, message: 'Invalid id' });
        const [mRows] = await pool.execute('SELECT * FROM aleco_b2b_messages WHERE id = ? LIMIT 1', [id]);
        const message = mRows?.[0];
        if (!message) return res.status(404).json({ success: false, message: 'Message not found.' });
        const list = await buildRecipientsForMessage(message);
        return res.json({
            success: true,
            data: {
                count: list.length,
                sample: list.slice(0, 50).map((r) => ({ email: r.email, name: r.contact_name })),
            },
        });
    } catch (err) {
        if (err instanceof TypeError) return res.status(400).json({ success: false, message: err.message });
        console.error('❌ POST /b2b-mail/messages/:id/preview-recipients:', err);
        return res.status(500).json({ success: false, message: 'Failed to preview recipients.' });
    }
});

router.post('/b2b-mail/messages/draft', async (req, res) => {
    try {
        const body = withActorFromReq(req, req.body || {});
        const id = await saveDraft(body);
        const [rows] = await pool.execute('SELECT * FROM aleco_b2b_messages WHERE id = ? LIMIT 1', [id]);
        return res.status(201).json({ success: true, data: rows?.[0] || null });
    } catch (err) {
        if (err instanceof TypeError) return res.status(400).json({ success: false, message: err.message });
        console.error('❌ POST /b2b-mail/messages/draft:', err);
        return res.status(500).json({ success: false, message: 'Failed to save draft.' });
    }
});

router.put('/b2b-mail/messages/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ success: false, message: 'Invalid id' });
        await saveDraft(withActorFromReq(req, { ...(req.body || {}), id }));
        const [rows] = await pool.execute('SELECT * FROM aleco_b2b_messages WHERE id = ? LIMIT 1', [id]);
        return res.json({ success: true, data: rows?.[0] || null });
    } catch (err) {
        if (err instanceof TypeError) return res.status(400).json({ success: false, message: err.message });
        console.error('❌ PUT /b2b-mail/messages/:id:', err);
        return res.status(500).json({ success: false, message: 'Failed to update draft.' });
    }
});

router.post('/b2b-mail/messages/:id/send', async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ success: false, message: 'Invalid id' });
        const result = await sendMessage(id);
        return res.json({ success: true, data: result });
    } catch (err) {
        if (err instanceof TypeError) return res.status(400).json({ success: false, message: err.message });
        console.error('❌ POST /b2b-mail/messages/:id/send:', err);
        return res.status(500).json({ success: false, message: 'Failed to send message.' });
    }
});

router.post('/b2b-mail/messages/:id/retry', async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ success: false, message: 'Invalid id' });
        const result = await sendMessage(id, { retryOnlyFailed: true });
        return res.json({ success: true, data: result });
    } catch (err) {
        if (err instanceof TypeError) return res.status(400).json({ success: false, message: err.message });
        console.error('❌ POST /b2b-mail/messages/:id/retry:', err);
        return res.status(500).json({ success: false, message: 'Failed to retry message.' });
    }
});

router.get('/b2b-mail/templates', async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT id, name, subject, body_html, body_text, is_system, created_by_email, created_at, updated_at
             FROM aleco_b2b_templates ORDER BY is_system DESC, name ASC`
        );
        return res.json({ success: true, data: rows });
    } catch (err) {
        console.error('❌ GET /b2b-mail/templates:', err);
        return res.status(500).json({ success: false, message: 'Failed to load templates.' });
    }
});

router.post('/b2b-mail/templates', async (req, res) => {
    try {
        const body = withActorFromReq(req, req.body || {});
        const name = String(body.name || '').trim();
        if (!name) return res.status(400).json({ success: false, message: 'Template name is required.' });
        const phNow = nowPhilippineForMysql();
        const [ins] = await pool.execute(
            `INSERT INTO aleco_b2b_templates
             (name, subject, body_html, body_text, is_system, created_by_email, created_at, updated_at)
             VALUES (?, ?, ?, ?, 0, ?, ?, ?)`,
            [
                name,
                body.subject ? String(body.subject) : '',
                body.bodyHtml ? String(body.bodyHtml) : null,
                body.bodyText ? String(body.bodyText) : null,
                body.actorEmail ? String(body.actorEmail) : null,
                phNow,
                phNow,
            ]
        );
        const [rows] = await pool.execute('SELECT * FROM aleco_b2b_templates WHERE id = ? LIMIT 1', [ins.insertId]);
        return res.status(201).json({ success: true, data: rows?.[0] || null });
    } catch (err) {
        console.error('❌ POST /b2b-mail/templates:', err);
        return res.status(500).json({ success: false, message: 'Failed to save template.' });
    }
});

router.get('/b2b-mail/inbound', async (req, res) => {
    try {
        // Enforce a strict 2-second timeout on the IMAP sync. If the IMAP server hangs, 
        // we abandon the active await so the UI renders instantly, while the sync finishes in the background.
        await Promise.race([
            pollB2BInboundOnce(),
            new Promise(resolve => setTimeout(resolve, 2000))
        ]).catch(() => {});

        const messageId = req.query.messageId != null && String(req.query.messageId).trim() !== '' ? Number(req.query.messageId) : null;
        const params = [];
        let sql = `SELECT id, provider_message_id, from_email, subject, body_text, in_reply_to,
            linked_message_id, linked_recipient_id, received_at, created_at
            FROM aleco_b2b_inbound_messages WHERE 1=1`;
        if (messageId != null && Number.isInteger(messageId) && messageId > 0) {
            sql += ' AND linked_message_id = ?';
            params.push(messageId);
        }
        sql += ' ORDER BY received_at DESC, id DESC LIMIT 200';
        const [rows] = await pool.execute(sql, params);
        return res.json({ success: true, data: rows });
    } catch (err) {
        console.error('❌ GET /b2b-mail/inbound:', err);
        return res.status(500).json({ success: false, message: 'Failed to load inbound mail.' });
    }
});

/**
 * Optional server-to-server ingest (e.g. Zapier, custom forwarder).
 * Set B2B_INBOUND_WEBHOOK_SECRET and send the same value in X-B2B-Webhook-Secret.
 */
router.post('/b2b-mail/inbound/webhook', async (req, res) => {
    try {
        const secret = process.env.B2B_INBOUND_WEBHOOK_SECRET;
        if (!secret || req.get('x-b2b-webhook-secret') !== secret) {
            return res.status(401).json({ success: false, message: 'Unauthorized.' });
        }
        const b = req.body || {};
        const providerId = String(b.providerMessageId || b.messageId || '').trim();
        if (!providerId) return res.status(400).json({ success: false, message: 'providerMessageId required.' });
        const fromEmail = String(b.fromEmail || b.from || 'unknown').slice(0, 255);
        const subject = String(b.subject || '').slice(0, 500);
        const bodyText = b.bodyText != null ? String(b.bodyText) : null;
        const inReplyTo = b.inReplyTo ? String(b.inReplyTo).slice(0, 500) : null;
        const references = b.references != null ? String(b.references) : null;
        const phNow = nowPhilippineForMysql();

        let linked_message_id = b.linkedMessageId != null ? Number(b.linkedMessageId) : null;
        let linked_recipient_id = b.linkedRecipientId != null ? Number(b.linkedRecipientId) : null;
        const norm = (s) =>
            String(s || '')
                .replace(/[<>]/g, '')
                .trim()
                .toLowerCase();
        if (!linked_message_id && inReplyTo) {
            const needle = norm(inReplyTo);
            const [recRows] = await pool.execute(
                `SELECT id, message_id FROM aleco_b2b_message_recipients
                 WHERE provider_message_id IS NOT NULL AND TRIM(provider_message_id) != ''
                 AND (
                   LOWER(REPLACE(REPLACE(TRIM(provider_message_id), '<', ''), '>', '')) = ?
                   OR TRIM(provider_message_id) = ?
                   OR TRIM(provider_message_id) = ?
                 )
                 LIMIT 1`,
                [needle, String(inReplyTo).trim(), `<${needle}>`]
            );
            const rr = recRows?.[0];
            if (rr) {
                linked_message_id = rr.message_id;
                linked_recipient_id = rr.id;
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
                    fromEmail,
                    subject,
                    bodyText,
                    inReplyTo,
                    references,
                    linked_message_id,
                    linked_recipient_id,
                    null,
                    phNow,
                ]
            );
        } catch (e) {
            if (e?.code === 'ER_DUP_ENTRY') {
                return res.json({ success: true, data: { duplicate: true } });
            }
            throw e;
        }
        return res.status(201).json({ success: true });
    } catch (err) {
        console.error('❌ POST /b2b-mail/inbound/webhook:', err);
        return res.status(500).json({ success: false, message: 'Webhook ingest failed.' });
    }
});

export default router;
