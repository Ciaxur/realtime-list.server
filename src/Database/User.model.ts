import * as Joi from 'joi';
import { generateHash } from '../Utils';
import { Schema, model } from 'mongoose';

// Auth Interface
export interface IUserSchema {
  _id?:          string;     // Unique Entry ID

  // Basic Information
  email:        string,
  password:     string,

  // Entry tracking information.
  createdAt:    Date;       // Creation date of the entry.
  updatedAt:    Date;       // Update date of the entry.
}

export const UserSchemaValidator = Joi.object({
  _id: Joi.string()
    .optional()
    .default(generateHash()),

  email: Joi.string()
    .required()
    .email()
    .lowercase(),

  password: Joi.string()
    .required()
    .min(6)
    .max(255)
});

// Create MongoDB schema.
const UserSchema = new Schema<IUserSchema>({
  email:    { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },

  // Timestamps.
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
});

export const UserModel = model('User', UserSchema);