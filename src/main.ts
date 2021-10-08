// Import Environment Variables
require('dotenv').config();
import { generateHash } from './Utils';
import * as jwt from 'jsonwebtoken';

// Env Vars
const {
  JWT_SECRET,
  CORS_ORIGIN,
} = process.env;

// Express & Socket.io Libraries
import * as express from 'express';
import * as SocketIO from 'socket.io';
import { createServer } from 'http';
import {
  IListSchema,
  ListObjectSchema,
} from './Database';

// Express Add-ons
import * as cors from 'cors';
import morgan = require('morgan');
import helmet = require('helmet');
import rateLimit = require('express-rate-limit');

// Database Init
import { FirebaseInstance } from './Database';
const database = FirebaseInstance.getDatabase();

// Setup in-memory Cache
import { cache } from './Cache'


// Setup & Configure Express with Socket.io
const app = express();

app.use(express.json());
app.use(cors({
  origin: CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(helmet());
app.use(morgan('dev'));
app.use(rateLimit({
  windowMs: 1 * 60 * 1000,    // 1 Minute
  max: 60,                    // 60 Request Max
}));

/**
 * Keep track of authorized sockets and their jwt
 */
interface IAuthorizedSocket {
  [socketId: string]: {
    tokenKey: string,
  },
}

const server = createServer(app);
const io = SocketIO(server);
const authorized_conx: IAuthorizedSocket = {};


// Listen for Socket Events
io.use((socket, next) => {  // Validate JWT
  const cookies = socket.handshake.headers.cookie;
  const token = cookies && cookies
    .split('; ')
    .reduce((prev: string, cur: string) => cur.startsWith('tokenKey') ? cur.split('=')[1] : prev, '');
  
  if (token) {
    jwt.verify(token, JWT_SECRET, (err: any) => {
      // Store reference to verified authorized socket conx
      if (!err) {
        authorized_conx[socket.id] = {
          tokenKey: token,
        }
      }
    });
  } else {
    console.log(`Socket[${socket.id}]: Invalid Token[${token}]`)
  }
  next();
})
.on('connection', socket => {
  console.log('Client Connected!');

  socket.on('disconnect', () => {
    delete authorized_conx[socket.id];
    console.log(`Socket[${socket.id}]: Client Disconnected!`);
  })

  socket.on('item-add', async (item: IListSchema) => {
    // Check if Authorized Socket Connection
    if (!authorized_conx[socket.id]) {
      io.emit('error', 'Unauthorized Socket Connection');
      console.log(`Socket[${socket.id}]: Unauthorized item-add`);
      return;
    }
    
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
      console.log(`Socket[${socket.id}]: Item Add Error:`, err);
      socket.emit('error', err);
    }
  });

  socket.on('item-del', async (item: IListSchema) => {
    // Check if Authorized Socket Connection
    if (!authorized_conx[socket.id]) {
      io.emit('error', 'Unauthorized Socket Connection');
      console.log(`Socket[${socket.id}]: Unauthorized item-del`);
      return;
    }
    
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
      console.log(`Socket[${socket.id}]: Item Removal Error:`, err);
      socket.emit('error', err);
    }
  });

  socket.on('item-update', async (item: IListSchema) => {
    // Check if Authorized Socket Connection
    if (!authorized_conx[socket.id]) {
      io.emit('error', 'Unauthorized Socket Connection');
      console.log(`Socket[${socket.id}]: Unauthorized item-update`);
      return;
    }
    
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
      console.log(`Socket[${socket.id}]: Item Update Error:`, err);
      socket.emit('error', err);
    }
  });

});



// Express Routes
import Routes from './Routes';

// Register Routes
app.use('/', Routes);


app.get('*', (_, res) => {
  res.json({});
});


// Start the Server on ::3030
console.log(`Listening on ::${process.env.PORT || '3030'}`);
server.listen(process.env.PORT || 3030);