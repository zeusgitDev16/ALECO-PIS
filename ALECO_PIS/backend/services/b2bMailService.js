import pool from '../config/db.js';
import { sendB2BMail } from '../utils/b2bMailProvider.js';
import { nowPhilippineForMysql } from '../utils/dateTimeUtils.js';

const MAX_RECIPIENTS = 300;

function parseJsonArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    try {
        const parsed = JSON.parse(String(value));
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export async function listContacts({ q = '', feederId = null, active = null }) {
    const where = [];
    const params = [];
    if (q && String(q).trim()) {
        where.push('(c.contact_name LIKE ? OR c.email LIKE ? OR c.company_name LIKE ?)');
        const token = `%${String(q).trim()}%`;
        params.push(token, token, token);
    }
    if (feederId != null && String(feederId).trim() !== '') {
        where.push(
            '(c.feeder_id = ? OR EXISTS (SELECT 1 FROM aleco_b2b_contact_feeders cf WHERE cf.contact_id = c.id AND cf.feeder_id = ?))'
        );
        params.push(Number(feederId), Number(feederId));
    }
    if (active === '0' || active === 0 || active === false) where.push('c.is_active = 0');
    if (active === '1' || active === 1 || active === true) where.push('c.is_active = 1');

    const sql = `SELECT
        c.id, c.company_name, c.contact_name, c.email, c.phone, c.feeder_id, c.is_active, c.created_at, c.updated_at,
        f.feeder_label AS feeder_label
      FROM aleco_b2b_contacts c
      LEFT JOIN aleco_feeders f ON f.id = c.feeder_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY c.updated_at DESC, c.id DESC`;
    const [rows] = await pool.execute(sql, params);
    return rows;
}

export async function upsertContact({ id = null, companyName, contactName, email, phone, feederId, feederIds }) {
    if (!contactName || !String(contactName).trim()) throw new TypeError('contactName is required');
    if (!email || !String(email).trim()) throw new TypeError('email is required');
    const normalizedEmail = String(email).trim().toLowerCase();
    const phNow = nowPhilippineForMysql();
    const primaryFeederId =
        feederId != null && String(feederId).trim() !== '' ? Number(feederId) : null;
    if (id == null) {
        const [ins] = await pool.execute(
            `INSERT INTO aleco_b2b_contacts
             (company_name, contact_name, email, phone, feeder_id, is_active, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
            [
                companyName ? String(companyName).trim() : '',
                String(contactName).trim(),
                normalizedEmail,
                phone ? String(phone).trim() : null,
                primaryFeederId,
                phNow,
                phNow,
            ]
        );
        id = ins.insertId;
    } else {
        await pool.execute(
            `UPDATE aleco_b2b_contacts
             SET company_name = ?, contact_name = ?, email = ?, phone = ?, feeder_id = ?, updated_at = ?
             WHERE id = ?`,
            [
                companyName ? String(companyName).trim() : '',
                String(contactName).trim(),
                normalizedEmail,
                phone ? String(phone).trim() : null,
                primaryFeederId,
                phNow,
                Number(id),
            ]
        );
    }

    const list = Array.isArray(feederIds)
        ? [...new Set(feederIds.map((x) => Number(x)).filter((n) => Number.isInteger(n) && n > 0))]
        : [];
    await pool.execute('DELETE FROM aleco_b2b_contact_feeders WHERE contact_id = ?', [Number(id)]);
    if (list.length > 0) {
        const placeholders = list.map(() => '(?, ?, ?)').join(', ');
        const args = [];
        for (const fid of list) args.push(Number(id), fid, phNow);
        await pool.execute(
            `INSERT INTO aleco_b2b_contact_feeders (contact_id, feeder_id, created_at) VALUES ${placeholders}`,
            args
        );
    }
    return Number(id);
}

export async function setContactActive(id, isActive) {
    const phNow = nowPhilippineForMysql();
    await pool.execute('UPDATE aleco_b2b_contacts SET is_active = ?, updated_at = ? WHERE id = ?', [
        isActive ? 1 : 0,
        phNow,
        Number(id),
    ]);
}

export async function buildRecipientsForMessage(messageRow) {
    const mode = String(messageRow.target_mode || 'all_feeders');
    const selectedFeederIds = parseJsonArray(messageRow.selected_feeder_ids).map((n) => Number(n));
    const selectedContactIds = parseJsonArray(messageRow.selected_contact_ids).map((n) => Number(n));

    let rows = [];
    if (mode === 'manual_contacts' && selectedContactIds.length > 0) {
        const q = selectedContactIds.map(() => '?').join(', ');
        const [r] = await pool.execute(
            `SELECT id, contact_name, email FROM aleco_b2b_contacts
             WHERE is_active = 1 AND id IN (${q})`,
            selectedContactIds
        );
        rows = r;
    } else if (mode === 'selected_feeders' && selectedFeederIds.length > 0) {
        const q = selectedFeederIds.map(() => '?').join(', ');
        const [r] = await pool.execute(
            `SELECT DISTINCT c.id, c.contact_name, c.email
             FROM aleco_b2b_contacts c
             LEFT JOIN aleco_b2b_contact_feeders cf ON cf.contact_id = c.id
             WHERE c.is_active = 1
               AND (c.feeder_id IN (${q}) OR cf.feeder_id IN (${q}))`,
            [...selectedFeederIds, ...selectedFeederIds]
        );
        rows = r;
    } else if (mode === 'interruption_linked' && messageRow.interruption_id) {
        const [ir] = await pool.execute('SELECT feeder_id FROM aleco_interruptions WHERE id = ? LIMIT 1', [
            Number(messageRow.interruption_id),
        ]);
        const fid = ir?.[0]?.feeder_id ? Number(ir[0].feeder_id) : null;
        if (fid) {
            const [r] = await pool.execute(
                `SELECT DISTINCT c.id, c.contact_name, c.email
                 FROM aleco_b2b_contacts c
                 LEFT JOIN aleco_b2b_contact_feeders cf ON cf.contact_id = c.id
                 WHERE c.is_active = 1 AND (c.feeder_id = ? OR cf.feeder_id = ?)`,
                [fid, fid]
            );
            rows = r;
        }
    } else {
        const [r] = await pool.execute(
            `SELECT DISTINCT c.id, c.contact_name, c.email
             FROM aleco_b2b_contacts c
             WHERE c.is_active = 1`
        );
        rows = r;
    }

    const dedup = new Map();
    for (const r of rows) {
        const email = String(r.email || '').trim().toLowerCase();
        if (!email) continue;
        if (!dedup.has(email)) dedup.set(email, r);
    }
    const recipients = Array.from(dedup.values());
    if (recipients.length > MAX_RECIPIENTS) {
        throw new TypeError(`Recipient count exceeds max ${MAX_RECIPIENTS}`);
    }
    return recipients;
}

export async function saveDraft(payload) {
    const phNow = nowPhilippineForMysql();
    const selectedFeederIds = JSON.stringify(
        Array.isArray(payload.selectedFeederIds) ? payload.selectedFeederIds.map((n) => Number(n)) : []
    );
    const selectedContactIds = JSON.stringify(
        Array.isArray(payload.selectedContactIds) ? payload.selectedContactIds.map((n) => Number(n)) : []
    );
    if (payload.id) {
        await pool.execute(
            `UPDATE aleco_b2b_messages
             SET subject=?, body_html=?, body_text=?, target_mode=?, selected_feeder_ids=?, selected_contact_ids=?,
                 interruption_id=?, template_id=?, created_by_email=?, created_by_name=?, status='draft', updated_at=?
             WHERE id=?`,
            [
                payload.subject || '',
                payload.bodyHtml || null,
                payload.bodyText || null,
                payload.targetMode || 'all_feeders',
                selectedFeederIds,
                selectedContactIds,
                payload.interruptionId ? Number(payload.interruptionId) : null,
                payload.templateId ? Number(payload.templateId) : null,
                payload.actorEmail || null,
                payload.actorName || null,
                phNow,
                Number(payload.id),
            ]
        );
        return Number(payload.id);
    }
    const [ins] = await pool.execute(
        `INSERT INTO aleco_b2b_messages
         (subject, body_html, body_text, target_mode, selected_feeder_ids, selected_contact_ids, interruption_id, template_id, created_by_email, created_by_name, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
        [
            payload.subject || '',
            payload.bodyHtml || null,
            payload.bodyText || null,
            payload.targetMode || 'all_feeders',
            selectedFeederIds,
            selectedContactIds,
            payload.interruptionId ? Number(payload.interruptionId) : null,
            payload.templateId ? Number(payload.templateId) : null,
            payload.actorEmail || null,
            payload.actorName || null,
            phNow,
            phNow,
        ]
    );
    return Number(ins.insertId);
}

export async function sendMessage(messageId, { retryOnlyFailed = false } = {}) {
    const id = Number(messageId);
    const [rows] = await pool.execute('SELECT * FROM aleco_b2b_messages WHERE id = ? LIMIT 1', [id]);
    const msg = rows?.[0];
    if (!msg) throw new TypeError('Message not found');
    const phNow = nowPhilippineForMysql();
    await pool.execute(`UPDATE aleco_b2b_messages SET status='sending', updated_at=? WHERE id=?`, [phNow, id]);

    let recipients;
    if (retryOnlyFailed) {
        const [r] = await pool.execute(
            `SELECT id, contact_id AS id_contact, name_snapshot AS contact_name, email_snapshot AS email
             FROM aleco_b2b_message_recipients WHERE message_id=? AND send_status='failed'`,
            [id]
        );
        recipients = r.map((x) => ({ id: x.id_contact, contact_name: x.contact_name, email: x.email }));
    } else {
        recipients = await buildRecipientsForMessage(msg);
        await pool.execute('DELETE FROM aleco_b2b_message_recipients WHERE message_id = ?', [id]);
        if (recipients.length > 0) {
            const ph = recipients.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
            const vals = [];
            for (const r of recipients) {
                vals.push(id, r.id || null, r.email, r.contact_name || '', 'queued', phNow, phNow);
            }
            await pool.execute(
                `INSERT INTO aleco_b2b_message_recipients
                 (message_id, contact_id, email_snapshot, name_snapshot, send_status, created_at, updated_at)
                 VALUES ${ph}`,
                vals
            );
        }
    }

    if (!recipients || recipients.length === 0) {
        await pool.execute(
            `UPDATE aleco_b2b_messages SET status='failed', last_error=?, updated_at=? WHERE id=?`,
            ['No recipients resolved.', phNow, id]
        );
        return { sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;
    for (const r of recipients) {
        const email = String(r.email || '').trim().toLowerCase();
        if (!email) continue;
        try {
            const result = await sendB2BMail({
                to: email,
                subject: msg.subject || 'ALECO B2B Advisory',
                text: msg.body_text || '',
                html: msg.body_html || undefined,
            });
            await pool.execute(
                `UPDATE aleco_b2b_message_recipients
                 SET send_status='sent', provider_message_id=?, error_message=NULL, sent_at=?, updated_at=?
                 WHERE message_id=? AND email_snapshot=?`,
                [result.providerMessageId, phNow, phNow, id, email]
            );
            sent += 1;
        } catch (err) {
            failed += 1;
            await pool.execute(
                `UPDATE aleco_b2b_message_recipients
                 SET send_status='failed', error_message=?, updated_at=?
                 WHERE message_id=? AND email_snapshot=?`,
                [err?.message || 'Send failed', phNow, id, email]
            );
        }
    }

    const finalStatus = failed > 0 && sent === 0 ? 'failed' : failed > 0 ? 'sent' : 'sent';
    await pool.execute(
        `UPDATE aleco_b2b_messages SET status=?, sent_at=?, last_error=?, updated_at=? WHERE id=?`,
        [finalStatus, phNow, failed > 0 ? `${failed} recipient(s) failed.` : null, phNow, id]
    );
    await pool.execute(
        `INSERT INTO aleco_b2b_mail_audit_logs (message_id, actor_email, actor_name, action, details, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, msg.created_by_email || null, msg.created_by_name || null, retryOnlyFailed ? 'retry' : 'send', `sent=${sent};failed=${failed}`, phNow]
    );

    return { sent, failed };
}
