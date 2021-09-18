import { Router } from 'express';
import ItemsRoute from './Items';
import AuthRoute from './Auth';

const app = Router();

// Register routes
app.use('/v1/items', ItemsRoute);
app.use('/v1/auth', AuthRoute);

// Route Export
export default app;