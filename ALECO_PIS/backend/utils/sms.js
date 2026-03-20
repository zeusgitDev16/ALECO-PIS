import axios from 'axios';
import { normalizePhoneForSMS } from './phoneUtils.js';

/** @typedef {{ success: boolean, skipped?: boolean, reason?: string, providerMessage?: string }} PhilSmsResult */

const MAX_PROVIDER_MSG = 400;

function truncateMsg(s) {
    if (s == null || typeof s !== 'string') return undefined;
    const t = s.trim();
    return t.length > MAX_PROVIDER_MSG ? `${t.slice(0, MAX_PROVIDER_MSG)}…` : t;
}

function pickErrorMessage(data) {
    if (!data || typeof data !== 'object') return undefined;
    if (typeof data.message === 'string') return data.message;
    if (typeof data.error === 'string') return data.error;
    return undefined;
}

/** Log safe SMS debug info (never prints full API key). */
function logPhilSmsDiagnosis(context, { url, formattedNumber, senderId, rawKey, apiKey }) {
    const msg = pickErrorMessage(context);
    const unauth =
        typeof msg === 'string' &&
        /unauthenticated/i.test(msg);

    const quotedDouble = apiKey.startsWith('"') && apiKey.endsWith('"');
    const quotedSingle = apiKey.startsWith("'") && apiKey.endsWith("'");
    const hadOuterWhitespace = rawKey != null && String(rawKey) !== apiKey;

    console.error('[PhilSMS] ─── request diagnosis (no secrets) ───');
    console.error(`[PhilSMS] URL: ${url}`);
    console.error(`[PhilSMS] Recipient (normalized): ${formattedNumber}`);
    console.error(`[PhilSMS] sender_id: ${senderId}`);
    console.error(
        `[PhilSMS] PHILSMS_API_KEY: loaded, length=${apiKey.length} chars` +
            (apiKey.includes('|') ? ' (contains "|" — typical PhilSMS token shape)' : '')
    );
    if (hadOuterWhitespace) {
        console.error(
            '[PhilSMS] ⚠ Key had leading/trailing spaces in .env; they were trimmed. Remove spaces in .env to avoid confusion.'
        );
    }
    if (quotedDouble || quotedSingle) {
        console.error(
            '[PhilSMS] ⚠ Key appears wrapped in quote characters. In .env use PHILSMS_API_KEY=yourtoken with NO surrounding quotes unless the token itself contains spaces.'
        );
    }
    if (context && typeof context === 'object') {
        console.error('[PhilSMS] Provider body:', context);
    }
    if (unauth) {
        console.error(
            '[PhilSMS] ➜ "Unauthenticated" = PhilSMS rejected the Bearer token. Regenerate/copy the API token from the PhilSMS developer dashboard into PHILSMS_API_KEY, restart the server, and ensure .env is in the folder you run node from (cwd).'
        );
    } else if (msg) {
        console.error(`[PhilSMS] ➜ Provider message: ${msg}`);
    }
    console.error('[PhilSMS] ─────────────────────────────────────');
}

/**
 * Send outbound SMS via PhilSMS API.
 * @returns {Promise<PhilSmsResult>}
 */
export const sendPhilSMS = async (number, messageBody) => {
    const formattedNumber = normalizePhoneForSMS(number);
    if (!formattedNumber) {
        console.error(`❌ PhilSMS: Invalid phone number "${number}" - skipping send`);
        return {
            success: false,
            skipped: true,
            reason: 'invalid_number',
            providerMessage: truncateMsg(`Invalid or unsupported phone: ${String(number)}`)
        };
    }

    const baseRaw = process.env.PHILSMS_API_URL || 'https://app.philsms.com';
    const baseUrl = String(baseRaw).replace(/\/+$/, '');
    const url = `${baseUrl}/api/v3/sms/send`;

    const rawKey = process.env.PHILSMS_API_KEY;
    const apiKey = (rawKey == null ? '' : String(rawKey)).trim();
    if (!apiKey) {
        console.error('❌ PhilSMS: PHILSMS_API_KEY is not set in .env');
        return {
            success: false,
            skipped: true,
            reason: 'no_api_key',
            providerMessage: 'PHILSMS_API_KEY is not configured'
        };
    }

    const senderId = process.env.PHILSMS_SENDER_ID || 'PhilSMS';
    const payload = {
        recipient: formattedNumber,
        message: messageBody,
        sender_id: senderId,
        type: 'plain'
    };

    try {
        const response = await axios.post(url, payload, {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                Accept: 'application/json',
                'Content-Type': 'application/json'
            }
        });
        if (response.data?.status === 'success') {
            console.log(`✅ PhilSMS Success! Message sent to ${formattedNumber}`);
            return { success: true };
        }
        console.warn(`⚠️ PhilSMS: Unexpected response`, response.data);
        logPhilSmsDiagnosis(response.data, {
            url,
            formattedNumber,
            senderId,
            rawKey,
            apiKey
        });
        return {
            success: false,
            reason: 'unexpected_response',
            providerMessage: truncateMsg(
                pickErrorMessage(response.data) || JSON.stringify(response.data)
            )
        };
    } catch (error) {
        const status = error.response?.status;
        const data = error.response?.data;
        console.error(`❌ PhilSMS Error:`, {
            status,
            data,
            message: error.message
        });
        logPhilSmsDiagnosis(data || { message: error.message }, {
            url,
            formattedNumber,
            senderId,
            rawKey,
            apiKey
        });
        return {
            success: false,
            reason: status ? 'http_error' : 'network_error',
            providerMessage: truncateMsg(
                pickErrorMessage(data) || (status ? `HTTP ${status}` : error.message)
            )
        };
    }
};
