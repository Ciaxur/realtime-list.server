import { Router } from 'express';
import { IAuthSchema, AuthObjectSchema } from '../Database';
import { cache } from '../Cache';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';

// Database Setup
import { FirebaseInstance } from '../Database';
import { generateHash } from '../Utils';
import { IEntryMetadata } from '../Interfaces/Common';
const database = FirebaseInstance.getDatabase();

// Allow Creation (Debug Only)
const DEBUG_ALLOW_AUTH_CREATE = false;

// Environment Vars
const {
  JWT_SECRET,
  HASH_SALT_ROUNDS,
} = process.env;

const app = Router();
export default app;

// Generates a JWT based on Login-Creds
app.post('/', async (req, res) => {
  // Validate Request
  const body: IAuthSchema = req.body;
  const validRes = AuthObjectSchema.validate(body);
  if (validRes.error) {
    return res.status(400).json({
      error: validRes.error.details
        .map(errDetails => errDetails.message),
    });
  }

  // Check Cache & DB for Credentials
  let paswdVerified = false;
  if (cache.users[body.email]) {
    paswdVerified = await bcrypt.compare(body.password, cache.users[body.email].password);
  }
  else {
    // Check db and update Cache
    const users = (await database
      .ref('users')
      .once('value')).toJSON();


    if (users) {
      for (const entry of Object.values(users)) {
        if (entry.email.toLowerCase() === body.email.toLowerCase()) {
          cache.users[body.email] = entry;
          paswdVerified = await bcrypt.compare(body.password, cache.users[body.email].password);
          break;
        }
      }
    }
  }
  if (!paswdVerified) {
    return res.status(401).json({
      message: 'Invalid credentials',
    });
  }
  
  // Generate JWT
  const tokenExpire = Math.floor(Date.now()) + (24 * 60 * 60 * 1000); // 24 Hours
  const token = jwt.sign(cache.users[body.email], JWT_SECRET, {
    expiresIn: tokenExpire,
  });
  
  return res
    .status(200)
    .cookie('tokenKey', token, { expires: new Date( tokenExpire ), secure: true, path: '/' })
    .json({
      message: 'Login Successful',
    });
});


// DEBUG: Only enable for time of creation
app.post('/create', async (req, res) => {
  // Check if endpoint is enabled
  if (!DEBUG_ALLOW_AUTH_CREATE)
    return res.status(403).json({});
  
  // Validate Request Body
  const body: IAuthSchema & IEntryMetadata = req.body;
  const validRes = AuthObjectSchema.validate(body);
  if (validRes.error) {
    return res.status(400).json({
      error: validRes.error.details
        .map(errDetails => errDetails.message),
    });
  }

  // Check if user is in cache
  let dupFound = false;
  if (cache.users[body.email]) {
    dupFound = true;
  } else {
    // Check db and update Cache
    const users = (await database
      .ref('users')
      .once('value')).toJSON();
    
    if (users) {
      for (const entry of Object.values(users)) {
        if (entry.email.toLowerCase() === body.email.toLowerCase()) {
          cache.users[body.email] = entry;
          dupFound = true;
          break;
        }
      }
    }
  }
  if (dupFound) {
    return res
      .status(409)
      .json({
        message: 'Email address already found',
      });
  }

  // Create account & hash
  const salt = await bcrypt.genSalt(parseInt(HASH_SALT_ROUNDS));
  const hashedPaswd = await bcrypt.hash(body.password, salt);

  // Add Account Metadata
  body._id = generateHash();
  body.password = hashedPaswd;
  body.createdAt = Date.now();
  body.modifiedAt = Date.now();

  // Add Account to DB
  return database.ref('users/' + body._id).set(body)
    .then(() => res.status(200).json({
      message: `Account ${body._id} added successfuly`,
    }))
    .catch(err => res.status(400).json({
      message: 'Account creation error',
      error: err,
    }));
});