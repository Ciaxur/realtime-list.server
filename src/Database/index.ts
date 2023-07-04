// Database Libraries
import mongoose from 'mongoose';

// Schemas
export * from './User.model';
export * from './Item.model';

/**
 * Initialize a connection to the mongoose database.
 * @param uri The connection URI to the mongoose database.
 * @returns Mongoose instance wrapped in a promise.
 */
export function initDatabase(uri: string): Promise<typeof mongoose> {
  return mongoose.connect(uri, {
    dbName: 'rtl',
  });
}