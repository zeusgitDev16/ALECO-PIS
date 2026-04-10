import { sendAppMail } from './appMail.js';

/**
 * B2B outbound: uses dedicated B2B transport when B2B_MAIL_USER/PASS set, else default app mail.
 * @param {object} opts
 * @param {string} opts.to
 * @param {string} opts.subject
 * @param {string} [opts.text]
 * @param {string} [opts.html]
 * @param {Record<string, string>} [opts.headers]
 * @param {string} [opts.replyTo]
 * @param {string} [opts.from]
 */
export async function sendB2BMail({ to, subject, text, html, headers, replyTo, from }) {
    const defaultFrom =
        from ||
        process.env.B2B_MAIL_FROM ||
        process.env.B2B_MAIL_USER ||
        process.env.EMAIL_USER;
    const replyToResolved =
        replyTo ||
        process.env.B2B_MAIL_REPLY_TO ||
        process.env.B2B_MAIL_USER ||
        process.env.EMAIL_USER;

    const result = await sendAppMail(
        {
            from: defaultFrom,
            to,
            subject: subject || 'ALECO B2B Advisory',
            text: text || '',
            html: html || undefined,
            headers: headers || undefined,
            replyTo: replyToResolved || undefined,
        },
        { useB2BTransport: true }
    );

    return {
        providerMessageId: result.messageId,
        accepted: result.accepted,
        rejected: result.rejected,
    };
}
