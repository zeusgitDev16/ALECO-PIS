import nodemailer from 'nodemailer';

let cachedTransporter = null;

function getTransporter() {
    if (cachedTransporter) return cachedTransporter;
    cachedTransporter = nodemailer.createTransport({
        service: process.env.B2B_MAIL_SERVICE || 'gmail',
        auth: {
            user: process.env.B2B_MAIL_USER || process.env.EMAIL_USER,
            pass: process.env.B2B_MAIL_PASS || process.env.EMAIL_PASS,
        },
    });
    return cachedTransporter;
}

export async function sendB2BMail({ to, subject, text, html }) {
    const transporter = getTransporter();
    const from = process.env.B2B_MAIL_FROM || process.env.B2B_MAIL_USER || process.env.EMAIL_USER;
    const info = await transporter.sendMail({
        from,
        to,
        subject: subject || 'ALECO B2B Advisory',
        text: text || '',
        html: html || undefined,
    });
    return {
        providerMessageId: info?.messageId || null,
        accepted: Array.isArray(info?.accepted) ? info.accepted : [],
        rejected: Array.isArray(info?.rejected) ? info.rejected : [],
    };
}
