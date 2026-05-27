/**
 * Client for calling the Cloud Run poster worker
 * Handles HTTP requests to the worker service
 */

/**
 * Capture poster via Cloud Run worker
 * @param {number} id - Advisory ID
 * @param {'print'|'infographic'} [variant] - Poster variant
 * @returns {Promise<{ posterUrl: string } | { error: string }>}
 */
export async function capturePosterViaWorker(id, variant = 'print') {
  const workerUrl = process.env.POSTER_WORKER_URL;
  const apiKey = process.env.POSTER_WORKER_API_KEY;

  if (!workerUrl) {
    return { error: 'POSTER_WORKER_URL not configured' };
  }

  if (!apiKey) {
    return { error: 'POSTER_WORKER_API_KEY not configured' };
  }

  try {
    const response = await fetch(`${workerUrl}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({ id, variant }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.error || `Worker returned ${response.status}` };
    }

    if (data.success && data.posterUrl) {
      return { posterUrl: data.posterUrl };
    }

    return { error: data.error || 'Worker returned invalid response' };
  } catch (error) {
    const msg = typeof error?.message === 'string' ? error.message : 'Worker request failed';
    console.error('[posterClient] Error calling worker:', msg);
    return { error: msg };
  }
}
