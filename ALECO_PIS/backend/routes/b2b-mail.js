import express from 'express';
import pool from '../config/db.js';
import {
    listContacts,
    upsertContact,
    setContactActive,
    saveDraft,
    sendMessage,
} from '../services/b2bMailService.js';
import { nowPhilippineForMysql } from '../utils/dateTimeUtils.js';

const router = express.Router();

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

router.post('/b2b-mail/messages/draft', async (req, res) => {
    try {
        const body = req.body || {};
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
        await saveDraft({ ...(req.body || {}), id });
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
        const body = req.body || {};
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

export default router;
