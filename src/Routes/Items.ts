import { Router } from 'express';
import {
  ItemModel,
} from '../Database';

// Router & Export setup
const app = Router();
export default app;

// Setup in-memory Cache
import { cache, CACHE_REFRESH_INTERVAL } from '../Cache'

// Interval Checker
const TRASH_REMOVE_INTERVAL = 30 * 24 * 60 * 60 * 1000;   // 30-Days
const intervalChecker = () => {
  // Check Cache for Trash (30 Days to Remove)
  const dateNow = Date.now();

  // Iterate the Cached List Checking
  if (cache.list !== null) {
    for (const item of Object.values(cache.list)) {
      if(item.isDeleted) {
        const deletedAt = Date.parse(item.deletedAt as any);

        // Prema-Delete if Trash is over 30 Days Old
        if(dateNow - deletedAt > TRASH_REMOVE_INTERVAL) {
          ItemModel.deleteOne({ _id: item._id })
            .then(() => console.log(`Trash removal -> deleted stale item -> ${item._id} | ${item.name}`))
            .catch(err => console.log(`Trash removal failed for item ${item._id},${item.name}: `, err));
        }
      }
    }
  }
};
setTimeout(intervalChecker, 10 * 1000);       // Start in 10 Seconds
setInterval(intervalChecker, 60 * 60 * 1000); // Check every 1 Hour

/** Retrieves entire Updated List */
app.get('/list', (req, res) => {
  // Check Cache
  if(cache.list !== null && (Date.now() - cache.lastUpdated) <= CACHE_REFRESH_INTERVAL) {
    res.statusCode = 200;
    res.json(Object.values(cache.list));
    return;
  }

  // TODO: RTL-22: update to be user-based.
  // Request all of the user's items.
  ItemModel.find().select('-__v')
    .then(itemArray => {
      // TODO: figure out cache. this returns an array of objects now.
      // cache.list = snapshot; // wrong type?
      // cache.lastUpdated = Date.now();

      res
        .status(200)
        .json(Object.values(itemArray));
    })
    .catch(err => {
      res.status(400).json(err);
    });
});