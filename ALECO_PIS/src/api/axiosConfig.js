import axios from 'axios';
import { getApiBaseUrl } from '../config/apiBase.js';
import { clearLocalStoragePreservingPreferences } from '../utils/clearLocalStoragePreservingPreferences.js';

const API = axios.create({
    baseURL: getApiBaseUrl(),
    headers: {
        'Content-Type': 'application/json'
    }
});

/**
 * GLOBAL LOADING INTERCEPTORS
 * These dispatch events that your LoadingProvider listens for.
 */

// 1. Request Interceptor: Triggered when you call API.post/get/etc.
API.interceptors.request.use((config) => {
    if (typeof localStorage !== 'undefined') {
        const accessToken = localStorage.getItem('accessToken');
        const email = localStorage.getItem('userEmail');
        const tokenVersion = localStorage.getItem('tokenVersion');
        config.headers = config.headers || {};
        if (accessToken && !config.headers.Authorization) {
            config.headers.Authorization = `Bearer ${accessToken}`;
        }
        if (email) {
            config.headers['X-User-Email'] = email;
        }
        if (tokenVersion !== null && tokenVersion !== undefined) {
            config.headers['X-Token-Version'] = String(tokenVersion);
        }
    }
    // Dispatch the show event to turn the spinner ON
    document.dispatchEvent(new Event('show-global-loader'));
    return config;
}, (error) => {
    // Hide loader if the request itself fails to even send
    document.dispatchEvent(new Event('hide-global-loader'));
    return Promise.reject(error);
});

// 2. Response Interceptor: Triggered when the server answers (success or error)
API.interceptors.response.use((response) => {
    // Dispatch the hide event to turn the spinner OFF
    document.dispatchEvent(new Event('hide-global-loader'));
    return response;
}, (error) => {
    // Hide loader even if the server returns an error (404, 500, etc.)
    document.dispatchEvent(new Event('hide-global-loader'));
    const code = error.response?.data?.code;
    if (
        error.response?.status === 401 &&
        ['AUTH_REQUIRED', 'AUTH_INVALID', 'AUTH_STALE'].includes(code)
    ) {
        clearLocalStoragePreservingPreferences();
        if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin-')) {
            window.location.assign('/');
        }
    }
    if (error.response?.status === 403 && code === 'AUTH_DISABLED') {
        clearLocalStoragePreservingPreferences();
        if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin-')) {
            window.location.assign('/');
        }
    }
    return Promise.reject(error);
});

export default API;