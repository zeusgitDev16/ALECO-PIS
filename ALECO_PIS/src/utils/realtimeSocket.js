import { io } from 'socket.io-client';
import { getApiBaseUrl } from '../config/apiBase.js';

let socketSingleton = null;

export function getRealtimeSocket() {
  if (socketSingleton) return socketSingleton;
  const baseUrl = getApiBaseUrl();
  socketSingleton = io(baseUrl, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    withCredentials: true,
  });
  return socketSingleton;
}

