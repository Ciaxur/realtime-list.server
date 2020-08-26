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
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
const server = createServer(app);
const io = SocketIO(server);

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
      await database.ref('list/' + item._id).set(item);

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

      // Broadcast Removal of Item to everyone
      io.emit('remove-item', item);
    }

    catch (err) {
      console.log('Item Removal Error:', err);
      socket.emit('error', err);
    }
  });

  socket.on('item-update', (item: IListSchema) => {
    console.log('Update', item);
  });

});



// Express Routes
/** Retrieves entire Updated List */
app.get('/list', (req, res) => {
  database.ref('/list')
    .once('value')
    .then(snapshot => {
      res.statusCode = 200;
      res.json(Object.values(snapshot.toJSON()));
    })
    .catch(err => {
      res.statusCode =  400;
      res.json(err);
    });
});


// Start the Server on ::3030
console.log('Listening on ::3030');
server.listen(3030);