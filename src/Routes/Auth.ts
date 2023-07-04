import { Router } from 'express';
import {
  IUserSchema,
  UserSchemaValidator,
  UserModel,
} from '../Database';
import { cache } from '../Cache';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';

// Database Setup
import { generateHash } from '../Utils';
import { IEntryMetadata } from '../Interfaces/Common';

// Allow Creation (Debug Only)
const DEBUG_ALLOW_AUTH_CREATE = false;

// Environment Vars
const {
  JWT_SECRET,
  HASH_SALT_ROUNDS,
} = process.env;

const app = Router();
export default app;

// TODO: Once there's an update endpoint, make sure the cache is updated too.

// Generates a JWT based on Login-Creds
app.post('/', async (req, res) => {
  // Validate Request
  const body: IUserSchema = req.body;
  const validRes = UserSchemaValidator.validate(body);
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
    // Check db.
    const user = (await UserModel.findOne({
      email: body.email.toLowerCase(),
    })).toJSON();

    // Update cache.
    cache.users[body.email] = user;
    paswdVerified = await bcrypt.compare(body.password, cache.users[body.email].password);
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
    .cookie('tokenKey', token, {
      expires: new Date( tokenExpire ),
      secure: true,
      sameSite: 'none',
      path: '/',
    })
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
  const body: IUserSchema & IEntryMetadata = req.body;
  const validRes = UserSchemaValidator.validate(body);
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
    // Check db.
    const user = (await UserModel.findOne({ email: body.email.toLowerCase() })).toJSON();

    // Check if the user already exists and update cache to minimize reads from DB.
    if (user) {
      dupFound = true;
      cache.users[body.email] = user;
    }
  }
  if (dupFound) {
    return res
      .status(409)
      .json({
        message: 'User already exists',
      });
  }

  // Create account & hash
  const salt = await bcrypt.genSalt(parseInt(HASH_SALT_ROUNDS));
  const hashedPaswd = await bcrypt.hash(body.password, salt);

  // Add Account Metadata
  body._id = generateHash();
  body.password = hashedPaswd;

  // Add Account to DB
  return UserModel.create(body)
    .then(() => res.status(200).json({
      message: `Account ${body._id} created successfuly`,
    }))
    .catch(err => res.status(400).json({
      message: 'Account creation error',
      error: err,
    }));
});