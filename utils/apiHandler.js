/**
 * Wraps Gemini calls to handle 503 (High Demand) errors with exponential backoff.
 * @param {Function} apiCall - The async function that calls GenAI
 * @param {number} retries - Maximum number of retries
 * @param {number} delay - Initial delay in milliseconds
 */

/**
 * Smart Gemini API Wrapper
 * Distinguishes between global spikes (503) and personal rate limits (429)
 */
async function callGeminiWithRetry(apiCall, retries = 3) {
    try {
        return await apiCall();
    } catch (err) {
        // Extract status from Google's Error Object
        const status = err.status || (err.error && err.error.code);
        const message = err.message || "";

        // CASE 1: Rate Limit Reached (Your Quota)
        if (status === 429 || status === 'RESOURCE_EXHAUSTED') {
            if (retries > 0) {
                console.warn("Rate limit reached (429). Waiting 60s for quota reset...");
                await new Promise(res => setTimeout(res, 60000)); // Wait over 1 minute
                return callGeminiWithRetry(apiCall, retries - 1);
            }
        }

        // CASE 2: High Demand / Spike (Google's Overload)
        if (status === 503 || status === 'UNAVAILABLE' || message.includes('503')) {
            if (retries > 0) {
                const delay = 5000; // 5 seconds is usually enough for a spike to pass
                console.warn(`Gemini is currently busy (503). Retrying in ${delay/1000}s...`);
                await new Promise(res => setTimeout(res, delay));
                return callGeminiWithRetry(apiCall, retries - 1);
            }
        }

        // If it's another error (400, 401, 404), don't retry, just throw it.
        throw err;
    }
}

module.exports = { callGeminiWithRetry };