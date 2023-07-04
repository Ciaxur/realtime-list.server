// Database Libraries
import mongoose from 'mongoose';

// Schemas
export * from './User.model';
export * from './Item.model';

/**
 * Wrapper for initializing a connection to the mongoose database.
 * @param uri The connection URI to the mongoose database.
 * @param timeout Retry timeout in milliseconds.
 */
export function initDatabaseWithRetry(uri: string, timeout: number) {
  console.log('Attempting database connection...');
  initDatabase(uri)
    .then(res => {
      const dbName = res.connection.db.databaseName;
      const dbEndpoint = `${res.connection.host}:${res.connection.port}`;
      console.log(`Mongodb connection successful -> (dbName=${dbName}|host=${dbEndpoint})`);
    })
    .catch(err => {
      console.log(`Mongodb connection failed retrying in ${timeout}ms -> `, err)
      setTimeout(() => {
        initDatabaseWithRetry(uri, timeout);
      }, timeout);
    });
}

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