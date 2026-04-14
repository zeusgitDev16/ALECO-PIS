import axios from 'axios';
import { getApiBaseUrl } from '../config/apiBase.js';

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
    return Promise.reject(error);
});

export default API;