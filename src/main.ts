// Express & Socket.io Libraries
import * as express from 'express';
import * as SocketIO from 'socket.io';
import { createServer } from 'http';
import IListSchema from './Database/ListSchema';

// Express Add-ons
import * as cors from 'cors';
import morgan = require('morgan');
import helmet = require('helmet');



// Setup & Configure Express with Socket.io
const app = express();
app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
const server = createServer(app);
const io = SocketIO(server);


// DEBUG: Central Database
const db: IListSchema[] = [];


// Listen for Socket Events
io.on('connection', socket => {
  console.log('Client Connected!');

  socket.on('disconnect', () => {
    console.log('Client Disconnected!');
  })

  socket.on('item-add', item => {
    // TODO: Verify Schema
    const data = JSON.parse(item);

    // Add if Valid Schema
    db.push(data);

    // Broadcast new Item to everyone except Client
    socket.broadcast.emit('new-item', data);
  });

});



// Express Routes
/** Retrieves entire Updated List */
app.get('/list', (req, res) => {
  res.statusCode = 200;
  res.json(db);
});


// Start the Server on ::3030
console.log('Listening on ::3030');
server.listen(3030);