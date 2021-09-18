// Setup Memory Cache
import { Cache } from '../Database/LocalCache';

// Cache Initial Value and Refresh Interval
const CACHE_REFRESH_INTERVAL = 60 * 60 * 1000;
const cache: Cache = {
  list: null,           // Initial Empty (Holds the List from DB)
  lastUpdated: null,    // Last Updated Cache in ms
};

export {
  CACHE_REFRESH_INTERVAL,
  cache,
};