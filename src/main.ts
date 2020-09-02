// Import Environment Variables
require('dotenv').config();
import { createHash } from 'crypto';

// Express & Socket.io Libraries
import * as express from 'express';
import * as SocketIO from 'socket.io';
import { createServer } from 'http';
import IListSchema, {
  ListObjectSchema,
} from './Database/ListSchema';

// Express Add-ons
import * as cors from 'cors';
import morgan = require('morgan');
import helmet = require('helmet');
import rateLimit = require('express-rate-limit');

// Database Libraries
import * as firebase from 'firebase/app';
import 'firebase/database';


// Firebase Setup
const firebaseConfig = {
  apiKey: process.env.apiKey,
  authDomain: process.env.authDomain,
  databaseURL: process.env.databaseURL,
  projectId: process.env.projectId,
  storageBucket: process.env.storageBucket,
  messagingSenderId: process.env.messagingSenderId,
  appId: process.env.appId,
  measurementId: process.env.measurementId,
};
firebase.initializeApp(firebaseConfig);
const database = firebase.database();


// Setup & Configure Express with Socket.io
const app = express();

app.use(express.json());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
}));
app.use(helmet());
app.use(morgan('dev'));
app.use(rateLimit({
  windowMs: 1 * 60 * 1000,    // 1 Minute
  max: 60,                    // 60 Request Max
}));

const server = createServer(app);
const io = SocketIO(server);

// Setup Memory Cache
import { Cache } from './Database/LocalCache';
// Cache Initial Value and Refresh Interval
const CACHE_REFRESH_INTERVAL = 60 * 60 * 1000;
const cache: Cache = {
  list: null,           // Initial Empty (Holds the List from DB)
  lastUpdated: null,    // Last Updated Cache in ms
};


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


// Helper Function for Generating Hashes
function generateHash() {
  const current_date = (new Date()).valueOf().toString();
  const random = Math.random().toString();
  return createHash('sha1').update(current_date + random).digest('hex');
}

// Listen for Socket Events
io.on('connection', socket => {
  console.log('Client Connected!');

  socket.on('disconnect', () => {
    console.log('Client Disconnected!');
  })

  socket.on('item-add', async (item: IListSchema) => {
    try {
      // Verify Schema
      ListObjectSchema.validate(item);

      // Add if Valid Schema
      item['_id'] = generateHash(); // Generate Hash ID
      item.isDeleted = false;       // Set Initial State
      await database.ref('list/' + item._id).set(item);

      // Update Cache
      if(cache.list !== null) {
        cache.list[item._id] = item;
      }

      // Broadcast new Item to everyone
      io.emit('new-item', item);
    }

    catch (err) {
      console.log('Item Add Error:', err);
      socket.emit('error', err);
    }
  });

  socket.on('item-del', async (item: IListSchema) => {
    try {
      // Verify Schema
      ListObjectSchema.validate(item);
    
      // Remove the Item in the List
      await database.ref('/list/' + item._id).remove();

      // Update Cache
      if(cache.list !== null) {
        delete cache.list[item._id];
      }

      // Broadcast Removal of Item to everyone
      io.emit('remove-item', item);
    }

    catch (err) {
      console.log('Item Removal Error:', err);
      socket.emit('error', err);
    }
  });

  socket.on('item-update', async (item: IListSchema) => {
    try {
      // Verify Schema
      ListObjectSchema.validate(item);
    
      // Remove the Item in the List
      await database.ref('/list/' + item._id).update(item);

      // Update Cache
      if(cache.list !== null) {
        cache.list[item._id] = item;
      }

      // Broadcast Update of Item to everyone
      io.emit('update-item', item);
    }

    catch (err) {
      console.log('Item Update Error:', err);
      socket.emit('error', err);
    }
  });

});



// Express Routes
/** Retrieves entire Updated List */
app.get('/list', (req, res) => {
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

app.get('*', (_, res) => {
  res.json({});
});


// Start the Server on ::3030
console.log(`Listening on ::${process.env.PORT || '3030'}`);
server.listen(process.env.PORT || 3030);