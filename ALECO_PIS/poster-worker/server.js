/**
 * Cloud Run Poster Worker Server
 * Express server that handles poster capture requests via Puppeteer
 */

import express from 'express';
import { captureWithHardTimeout } from './posterCapture.js';

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(express.json());

// API Key Authentication Middleware
function requireApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  const expectedKey = process.env.POSTER_WORKER_API_KEY;
  
  if (!expectedKey) {
    console.error('[worker] POSTER_WORKER_API_KEY not set in environment');
    return res.status(500).json({ 
      success: false, 
      error: 'Server configuration error: API key not set' 
    });
  }
  
  if (!apiKey) {
    return res.status(401).json({ 
      success: false, 
      error: 'API key required' 
    });
  }
  
  if (apiKey !== expectedKey) {
    console.warn(`[worker] Invalid API key attempt from ${req.ip}`);
    return res.status(403).json({ 
      success: false, 
      error: 'Invalid API key' 
    });
  }
  
  next();
}

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString() 
  });
});

// Poster capture endpoint
app.post('/capture', requireApiKey, async (req, res) => {
  const { id, variant = 'print' } = req.body;
  
  // Validate input
  if (!id || typeof id !== 'number' || id <= 0) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid id: must be a positive number' 
    });
  }
  
  if (!['print', 'infographic'].includes(variant)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid variant: must be "print" or "infographic"' 
    });
  }
  
  console.log(`[worker] Capture request: id=${id}, variant=${variant}`);
  
  try {
    const result = await captureWithHardTimeout(id, variant);
    
    if (result.error) {
      console.error(`[worker] Capture failed for id=${id}:`, result.error);
      return res.status(500).json({ 
        success: false, 
        error: result.error 
      });
    }
    
    console.log(`[worker] Capture succeeded for id=${id}:`, result.posterUrl);
    return res.json({ 
      success: true, 
      posterUrl: result.posterUrl 
    });
    
  } catch (error) {
    console.error(`[worker] Unexpected error for id=${id}:`, error);
    return res.status(500).json({ 
      success: false, 
      error: typeof error?.message === 'string' ? error.message : 'Internal server error' 
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    error: 'Not found' 
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[worker] Poster worker listening on port ${PORT}`);
  console.log(`[worker] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[worker] Cloudinary configured: ${!!process.env.CLOUDINARY_CLOUD_NAME}`);
  console.log(`[worker] API key configured: ${!!process.env.POSTER_WORKER_API_KEY}`);
});
