// Import Environment Variables
require('dotenv').config();
import * as fs from 'fs';

// Env Vars
const {
  CORS_ORIGIN,
  HTTPS_SERVER_PRIVATE_KEY,
  HTTPS_SERVER_CERTIFICATE,
  HTTPS_SERVER_CA,
  HTTPS_TRUSTED_CLIENT_CA_LIST,
  MONGOOSE_URI,
} = process.env;

// Express & Socket.io Libraries
import * as express from 'express';
import * as cookieParser from 'cookie-parser';
import { Server as SocketServer } from 'socket.io';
import { getHandleOnSocketConnection } from './Websocket/handlers';
import { createServer } from 'https';
import * as tls from 'tls';
import { initDatabaseWithRetry } from './Database';

// Express Add-ons
import * as cors from 'cors';
import helmet from 'helmet';
import morgan = require('morgan');
import rateLimit = require('express-rate-limit');

// Keep retrying database connection.
initDatabaseWithRetry(MONGOOSE_URI, 2000);

// Setup & Configure Express with Socket.io
const app = express();
app.use(express.json());
app.use(cookieParser());
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
.on('connection', getHandleOnSocketConnection(io));

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