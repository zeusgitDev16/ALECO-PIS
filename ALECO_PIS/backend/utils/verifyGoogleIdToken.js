import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client();

/**
 * Resolve Web client ID (must match VITE_GOOGLE_CLIENT_ID / Google Cloud OAuth client).
 */
function getGoogleOAuthClientId() {
    return (process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '').trim();
}

/**
 * Verifies a Google Sign-In ID token (JWT) from the browser.
 * @param {string} idToken - credential field from GoogleLogin onSuccess
 * @returns {Promise<{ email: string, name: string, picture: string, sub: string }>}
 */
export async function verifyGoogleIdToken(idToken) {
    if (!idToken || typeof idToken !== 'string') {
        const err = new Error('MISSING_ID_TOKEN');
        err.code = 'MISSING_ID_TOKEN';
        throw err;
    }

    const audience = getGoogleOAuthClientId();
    if (!audience) {
        const err = new Error('GOOGLE_CLIENT_ID_NOT_CONFIGURED');
        err.code = 'GOOGLE_CLIENT_ID_NOT_CONFIGURED';
        throw err;
    }

    let ticket;
    try {
        ticket = await client.verifyIdToken({
            idToken,
            audience,
        });
    } catch (e) {
        const err = new Error('INVALID_GOOGLE_TOKEN');
        err.code = 'INVALID_GOOGLE_TOKEN';
        err.cause = e;
        throw err;
    }

    const payload = ticket.getPayload();
    if (!payload?.email) {
        const err = new Error('TOKEN_NO_EMAIL');
        err.code = 'TOKEN_NO_EMAIL';
        throw err;
    }

    if (payload.email_verified === false) {
        const err = new Error('EMAIL_NOT_VERIFIED');
        err.code = 'EMAIL_NOT_VERIFIED';
        throw err;
    }

    return {
        email: String(payload.email).trim().toLowerCase(),
        name: payload.name ? String(payload.name) : '',
        picture: payload.picture ? String(payload.picture) : '',
        sub: payload.sub ? String(payload.sub) : '',
    };
}
