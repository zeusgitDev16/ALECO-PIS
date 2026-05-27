import { io } from 'socket.io-client';
import { getApiBaseUrl } from '../config/apiBase.js';

let socketSingleton = null;

export function getRealtimeSocket() {
  if (socketSingleton) return socketSingleton;
  const baseUrl = getApiBaseUrl();
  const baseUrlWithSlash = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  console.log(`[socket.io] Connecting to: ${baseUrlWithSlash}`);
  
  socketSingleton = io(baseUrlWithSlash, {
    path: '/socket.io',
    transports: ['websocket'],
    upgrade: false,
    withCredentials: true,
  });

  socketSingleton.on('connect', () => {
    console.log(`[socket.io] Connected successfully: ${socketSingleton.id}`);
  });

  socketSingleton.on('connect_error', (error) => {
    console.error(`[socket.io] Connection error:`, error);
  });

  socketSingleton.on('disconnect', (reason) => {
    console.warn(`[socket.io] Disconnected: ${reason}`);
  });

  return socketSingleton;
}

