import nodemailer from 'nodemailer';

let defaultTransporter = null;
let b2bTransporter = null;

/**
 * Shared Gmail (or nodemailer "service") transport for app mail: tickets, auth, user invites.
 * Matches legacy behavior: service 'gmail', EMAIL_USER, EMAIL_PASS.
 */
export function getDefaultMailTransporter() {
    if (!defaultTransporter) {
        defaultTransporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });
    }
    return defaultTransporter;
}

/**
 * Optional dedicated mailbox for B2B; falls back to default when B2B creds not set.
 */
export function getB2BMailTransporter() {
    const user = process.env.B2B_MAIL_USER;
    const pass = process.env.B2B_MAIL_PASS;
    if (!user || !pass) {
        return getDefaultMailTransporter();
    }
    if (!b2bTransporter) {
        b2bTransporter = nodemailer.createTransport({
            service: process.env.B2B_MAIL_SERVICE || 'gmail',
            auth: { user, pass },
        });
    }
    return b2bTransporter;
}

/**
 * @param {object} opts
 * @param {string} [opts.from]
 * @param {string} opts.to
 * @param {string} opts.subject
 * @param {string} [opts.text]
 * @param {string} [opts.html]
 * @param {Record<string, string>} [opts.headers]
 * @param {string} [opts.replyTo]
 * @param {{ useB2BTransport?: boolean }} [mailKind]
 */
export async function sendAppMail(opts, { useB2BTransport = false } = {}) {
    const transporter = useB2BTransport ? getB2BMailTransporter() : getDefaultMailTransporter();
    const from = opts.from ?? process.env.EMAIL_USER;
    const info = await transporter.sendMail({
        from,
        to: opts.to,
        subject: opts.subject,
        text: opts.text,
        html: opts.html,
        headers: opts.headers,
        replyTo: opts.replyTo,
    });
    return {
        messageId: info?.messageId || null,
        accepted: Array.isArray(info?.accepted) ? info.accepted : [],
        rejected: Array.isArray(info?.rejected) ? info.rejected : [],
    };
}
