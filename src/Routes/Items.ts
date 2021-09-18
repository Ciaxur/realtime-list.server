import { Router } from 'express';
import { FirebaseInstance, IAuthSchema } from '../Database';
import * as jwt from 'jsonwebtoken';

// Env
const {
  JWT_SECRET,
} = process.env;


// Router & Export setup
const app = Router();
export default app;

// Get Database instance
const database = FirebaseInstance.getDatabase();

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
        const dateDeleted = Date.parse(item.dateDeleted as any);

        // Prema-Delete if Trash is over 30 Days Old
        if(dateNow - dateDeleted > TRASH_REMOVE_INTERVAL) {
          database.ref('/list/' + item._id).remove();
        }
      }
    }
  }
};
setTimeout(intervalChecker, 10 * 1000);       // Start in 10 Seconds
setInterval(intervalChecker, 60 * 60 * 1000); // Check every 1 Hour

/** Retrieves entire Updated List */
app.get('/list', (req, res) => {
  // Check JWT/Auth
  const cookies = (req.headers.cookie || '').split('; ');
  const token = cookies.reduce((prev, cur) => cur.startsWith('tokenKey') ? cur.split('=')[1] : prev, '');
  let userEntry: IAuthSchema | null = null;

  if (!token) {
    return res
      .status(401)
      .json({
        message: 'Unauthorized request',
      });
  } else {
    try {
      userEntry = jwt.verify(token, JWT_SECRET) as any;
    } catch(err) {
      return res.status(401).json({
        message: 'Unauthorized request',
      });
    }
  }

  // Check Cache
  if(cache.list !== null && (Date.now() - cache.lastUpdated) <= CACHE_REFRESH_INTERVAL) {
    res.statusCode = 200;
    res.json(Object.values(cache.list));
    return;
  }
  
  // Request data from DB
  database.ref('/list')
    .once('value')
    .then(snapshot => {
      // Store in Cache
      cache.list = (snapshot.toJSON() as any);
      cache.lastUpdated = Date.now();
      
      res.statusCode = 200;
      res.json(Object.values(cache.list));
    })
    .catch(err => {
      res.statusCode =  400;
      res.json(err);
    });
});