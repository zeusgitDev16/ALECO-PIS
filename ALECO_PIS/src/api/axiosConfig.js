import axios from 'axios';

// This is the Global Setting
const API = axios.create({
    // It automatically uses your deployed URL or localhost
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
    headers: {
        'Content-Type': 'application/json'
    }
});

// You can also add "Interceptors" here later for things like 
// Global Error Handling or Global Loading Spinners.

export default API;