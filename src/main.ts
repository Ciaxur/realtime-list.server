// Import Environment Variables
require('dotenv').config();
import { generateHash } from './Utils';
import * as jwt from 'jsonwebtoken';
import * as fs from 'fs';
import {
  parse as parseCookies,
  serialize as serializeCookie,
} from 'cookie';

// Env Vars
const {
  JWT_SECRET,
  CORS_ORIGIN,
  HTTPS_SERVER_PRIVATE_KEY,
  HTTPS_SERVER_CERTIFICATE,
  HTTPS_SERVER_CA,
  HTTPS_TRUSTED_CLIENT_CA_LIST,
} = process.env;

// Express & Socket.io Libraries
import * as express from 'express';
import { Socket, Server as SocketServer } from 'socket.io';
import { createServer } from 'https';
import * as tls from 'tls';
import {
  IListSchema,
  ListObjectSchema,
} from './Database';

// Express Add-ons
import * as cors from 'cors';
import helmet from 'helmet';
import morgan = require('morgan');
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
console.log(`Using CORS_ORIGIN=${CORS_ORIGIN||'*'}`);
app.use(helmet());
app.use(morgan('dev'));
app.use(rateLimit({
  windowMs: 1 * 60 * 1000,    // 1 Minute
  max: 60,                    // 60 Request Max
}));

/**
 * Keep track of authorized sockets and their jwt
 */
interface IClientCookie {
  tokenKey?:  string,
};
interface IActiveSocket {
  // Established ipv4:port(address) connection.
  [socketRemoteAddr: string]: {
    socketId:   string | null,
    socket:     Socket | null,
    tokenKey:   string | null,
    authorized: boolean,
    cookies:    IClientCookie,
  },
}
const activeSocketConx: IActiveSocket = {};

// Read in TLS server/client certificates.
const serverPrivateKey = fs.readFileSync(HTTPS_SERVER_PRIVATE_KEY, 'utf8');
const serverCertificate = fs.readFileSync(HTTPS_SERVER_CERTIFICATE, 'utf8');
const serverCA = fs.readFileSync(HTTPS_SERVER_CA, 'utf8');

// Read in trusted client CA's to authorize.
const trustedClientCAs = HTTPS_TRUSTED_CLIENT_CA_LIST
  .split(',')
  .map(clientCaPath => fs.readFileSync(clientCaPath, 'utf8'));

// Create an HTTPS server with options.
const server = createServer({
  // Server TLS
  key: serverPrivateKey,
  cert: serverCertificate,

  // Trusted CAs
  ca: [
    serverCA,
    ...trustedClientCAs,
  ],
  requestCert: true,

  // Disable rejecting unauthorized clients to be handled by custom implementation
  // for logging purposes.
  rejectUnauthorized: false,
},app);
const io = new SocketServer(server, {
  cors: {
    origin: CORS_ORIGIN || '*',
  },
  cookie: {
    name: 'io',
    httpOnly: true,
    secure: true,
    path: '/',
  },
});

// Listen for Socket Events
io.use((_, next) => {
  next();
})
.on('connection', socket => {
  const remoteAddr = `${socket.request.connection.remoteAddress}:${socket.request.connection.remotePort}`;
  console.log(`Socket[${socket.id}]: Client '${remoteAddr}' Connected!`);

  // Keep track of active connections.
  let activeSocket = activeSocketConx[socket.id];
  if (!activeSocket) {
    activeSocketConx[socket.id] = {
      socketId:   socket.id,
      socket:     socket,
      tokenKey:   null,
      authorized: false,

      // Cookies are passed in after successful handshake with client.
      cookies:    {},
    }
    activeSocket = activeSocketConx[socket.id];
  }

  // Extract client token and validate.
  const cookies: string | undefined = socket.handshake.auth.cookies;
  if (cookies) {
    activeSocket.cookies = parseCookies(cookies);
    activeSocket.tokenKey = activeSocket.cookies.tokenKey || null;
  }

  if (activeSocket.tokenKey) {
    jwt.verify(activeSocket.tokenKey, JWT_SECRET, (err: any) => {
      // Store reference to verified authorized socket conx
      if (!err) {
        console.log(`Authorized connection '${socket.id}'`);
        activeSocket.authorized = true;
        activeSocket.socket.emit('authorized', true);
      }
    });
  } else {
    console.log(`Session[${activeSocket.socketId}]: Invalid Token[${activeSocket.tokenKey}]`)
  }

  socket.on('disconnect', () => {
    delete activeSocketConx[socket.id];
    console.log(`Socket[${socket.id}]: Client '${socket.id}' Disconnected!`);

    console.log('DEBUG: Active sockets -> ', Object.keys(activeSocketConx).length);
  })

  socket.on('item-add', async (item: IListSchema) => {
    // Check if Authorized Socket Connection
    if (!activeSocket.authorized) {
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
    if (!activeSocket.authorized) {
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
    if (!activeSocket.authorized) {
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

// Server Middleware
app.use((req, res, next) => {
  const clientTlsSocket = req.socket as tls.TLSSocket;

  // Verify the authorization of the client.
  if (!clientTlsSocket.authorized) {
    console.log(`${Date.now()} [TLS Auth]: Client TLS connection was unauthorized due to:`, clientTlsSocket.authorizationError);
    return res.status(403).send('Unauthorized user');
  } else {
    console.log(`${Date.now()} [TLS Auth]: Client TLS Authorized for`, clientTlsSocket.address());
  }

  next();
});

// Register Routes
app.use('/', Routes);


app.get('*', (_, res) => {
  res.json({});
});


// Start the Server on ::3030
console.log(`Listening on ::${process.env.PORT || '3030'}`);
server.listen(process.env.PORT || 3030);