const CoinConfig = require('../models/CoinConfig');
const { COIN_VALUES } = require('../constants');

// Cache for coin values (refresh every 5 minutes)
let coinCache = {};
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get coin value for a specific action
 * @param {string} key - The coin config key (e.g., 'POST_UPLOAD', 'REFERRAL_BONUS')
 * @returns {Promise<number>} - The coin value
 */
async function getCoinValue(key) {
  // Check cache first
  const now = Date.now();
  if (coinCache[key] !== undefined && (now - cacheTimestamp) < CACHE_DURATION) {
    return coinCache[key];
  }

  try {
    // Fetch from database
    const config = await CoinConfig.findOne({ key });
    
    if (config) {
      coinCache[key] = config.value;
      cacheTimestamp = now;
      return config.value;
    }

    // If not found in database, use default from constants
    const defaultValue = COIN_VALUES[key] || 0;
    coinCache[key] = defaultValue;
    cacheTimestamp = now;
    return defaultValue;
  } catch (error) {
    console.error(`Error fetching coin value for ${key}:`, error);
    // Fallback to default
    return COIN_VALUES[key] || 0;
  }
}

/**
 * Get all coin values (for bulk operations)
 * @returns {Promise<Object>} - Object with all coin values
 */
async function getAllCoinValues() {
  const now = Date.now();
  
  // Check if cache is still valid
  if (Object.keys(coinCache).length > 0 && (now - cacheTimestamp) < CACHE_DURATION) {
    return coinCache;
  }

  try {
    const configs = await CoinConfig.find();
    const values = {};
    
    // Build values object from database
    configs.forEach((config) => {
      values[config.key] = config.value;
    });

    // Fill in any missing values with defaults
    Object.keys(COIN_VALUES).forEach((key) => {
      if (values[key] === undefined) {
        values[key] = COIN_VALUES[key];
      }
    });

    coinCache = values;
    cacheTimestamp = now;
    return values;
  } catch (error) {
    console.error('Error fetching all coin values:', error);
    // Return defaults on error
    return COIN_VALUES;
  }
}

/**
 * Clear the coin cache (call this after updating coin values)
 */
function clearCoinCache() {
  coinCache = {};
  cacheTimestamp = 0;
}

module.exports = {
  getCoinValue,
  getAllCoinValues,
  clearCoinCache,
};

