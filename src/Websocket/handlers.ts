// Setup in-memory Cache
import { cache } from '../Cache';
import * as jwt from 'jsonwebtoken';
import {
  parse as parseCookies,
} from 'cookie';

// Express & Socket.io Libraries
import { Socket, Server as SocketServer } from 'socket.io';
import {
  IItemSchema,
  ItemModel,
  ItemSchemaValdator,
} from '../Database';
import { revokedTokens } from '../Routes/Auth/tracking';

// Env Vars
const {
  JWT_SECRET,
} = process.env;


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
export const activeSocketConx: IActiveSocket = {};


/**
 * Creates a socket on 'connection' handler.
 * @param io Established socket server instance.
 * @returns On connection handler function.
 */
export function getHandleOnSocketConnection(io: SocketServer) {
  return (socket: Socket) => {
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

    if (activeSocket.tokenKey && !revokedTokens.has(activeSocket.tokenKey)) {
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

    socket.on('item-add', async (item: IItemSchema) => {
      // Check if Authorized Socket Connection
      if (!activeSocket.authorized) {
        io.emit('error', 'Unauthorized Socket Connection');
        console.log(`Socket[${socket.id}]: Unauthorized item-add`);
        return;
      }

      try {
        // Verify Schema
        ItemSchemaValdator.validate(item);

        // Add if Valid Schema
        await ItemModel.create(item)

        // Update Cache
        if(cache.list !== null) {
          cache.list[item._id] = item;
        }

        // Broadcast new Item to everyone
        io.emit('new-item', item);
        console.log(`New item added by '${remoteAddr}|${socket.id}' -> ${item.name}`);
      }

      catch (err) {
        console.log(`Socket[${socket.id}]: Item Add Error:`, err);

        // TODO: RTL-23: Clean up returned error.
        // socket.emit('error', err);
        socket.emit('error', { message: 'UPDATE ME' })
      }
    });

    socket.on('item-del', async (item: IItemSchema) => {
      // Check if Authorized Socket Connection
      if (!activeSocket.authorized) {
        io.emit('error', 'Unauthorized Socket Connection');
        console.log(`Socket[${socket.id}]: Unauthorized item-del`);
        return;
      }

      try {
        // Verify Schema
        ItemSchemaValdator.validate(item);

        // Remove the Item in the List
        await ItemModel.deleteOne({
          _id: item._id,
        })

        // Update Cache
        if(cache.list !== null) {
          delete cache.list[item._id];
        }

        // Broadcast Removal of Item to everyone
        io.emit('remove-item', item);
        console.log(`Item deleted by '${remoteAddr}|${socket.id}' -> ${item.name}`);
      }

      catch (err) {
        console.log(`Socket[${socket.id}]: Item Removal Error:`, err);
        // TODO: RTL-23: Clean up returned error.
        // socket.emit('error', err);
        socket.emit('error', { message: 'UPDATE ME' })
      }
    });

    socket.on('item-update', async (item: IItemSchema) => {
      // Check if Authorized Socket Connection
      if (!activeSocket.authorized) {
        io.emit('error', 'Unauthorized Socket Connection');
        console.log(`Socket[${socket.id}]: Unauthorized item-update`);
        return;
      }

      try {
        // Verify Schema
        ItemSchemaValdator.validate(item);

        // Remove the Item in the List
        await ItemModel.updateOne({
          _id: item._id
        }, item);

        // Update Cache
        if(cache.list !== null) {
          cache.list[item._id] = item;
        }

        // Broadcast Update of Item to everyone
        io.emit('update-item', item);
        console.log(`Item updated by '${remoteAddr}|${socket.id}' -> ${item.name}`);
      }

      catch (err) {
        console.log(`Socket[${socket.id}]: Item Update Error:`, err);
        // TODO: RTL-23: Clean up returned error.
        // socket.emit('error', err);
        socket.emit('error', { message: 'UPDATE ME' })
      }
    });
  };
}