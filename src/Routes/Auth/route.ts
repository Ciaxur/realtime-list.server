import { Router } from 'express';
import {
  IUserSchema,
  UserSchemaValidator,
  UserModel,
} from '../../Database';
import { cache } from '../../Cache';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';

// Database Setup
import { IEntryMetadata } from '../../Interfaces/Common';
import { activeSocketConx } from '../../Websocket/handlers';
import { revokedTokens } from './tracking';

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
    const user = await UserModel.findOne({
      email: body.email.toLowerCase(),
    });

    // Ensure the user was found.
    if (user) {
      // Update cache and verify credentials.
      cache.users[body.email] = user.toJSON();
      paswdVerified = await bcrypt.compare(body.password, cache.users[body.email].password);
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

app.post('/create', async (req, res) => {
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
    const user = await UserModel.findOne({ email: body.email.toLowerCase() });

    // Check if the user already exists and update cache to minimize reads from DB.
    if (user) {
      dupFound = true;
      cache.users[body.email] = user.toJSON();
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
  body.password = hashedPaswd;

  // Add Account to DB
  return UserModel.create(body)
    .then((newUser) => {
      console.log(`Account created -> ${newUser.email} | ${newUser._id}`);
      return res.status(200).json({
        message: `Account ${newUser.email} created successfuly`,
      });
    })
    .catch(err => res.status(400).json({
      message: 'Account creation error',
      error: err,
    }));
});

app.post('/logoff', async (req, res) => {
  // Remove logged in token.
  const token = req.cookies.tokenKey;

  if (token && !revokedTokens.has(token)) {
    for (const activeSockVal of Object.values(activeSocketConx)) {
      if (activeSockVal.tokenKey == token) {
        activeSockVal.authorized = false;
      }
    }

    // Revoke token.
    revokedTokens.add(token);

    // Set a timeout to remove the token based on the TTL.
    const decodedToken = jwt.decode(token, {
      json: true
    });
    const expiresIn = decodedToken.exp - Date.now();

    if (expiresIn > 0) {
      console.log(`DEBUG: Setting token revocation for the removal of ${token} in ${expiresIn}ms`);
      setTimeout(() => {
        revokedTokens.delete(token);
      }, expiresIn);
    }

    res.clearCookie('tokenKey');

    return res
      .status(200)
      .json({});
  }

  return res.status(200).json({});
});