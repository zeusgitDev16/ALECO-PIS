import { io } from 'socket.io-client';
import { getApiBaseUrl } from '../config/apiBase.js';

let socketSingleton = null;

export function getRealtimeSocket() {
  if (socketSingleton) return socketSingleton;
  const baseUrl = getApiBaseUrl();
  console.log(`[socket.io] Connecting to: ${baseUrl}`);
  
  socketSingleton = io(baseUrl, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
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

