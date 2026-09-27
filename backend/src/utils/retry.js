// Bounded retries for transient provider errors. Never retry authentication errors.
module.exports = async function retry(operation, { attempts = 3, sleep = ms => new Promise(r => setTimeout(r, ms)) } = {}) {
  for (let attempt = 0; ; attempt++) {
    try { return await operation(); } catch (error) {
      const status = error.http_code || error.status || error.response?.status;
      if (attempt + 1 >= attempts || ![429, 500, 502, 503, 504].includes(status)) throw error;
      await sleep(Math.min(4000, 500 * 2 ** attempt));
    }
  }
};
