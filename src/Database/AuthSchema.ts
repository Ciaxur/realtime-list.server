import * as Joi from 'joi';
import { generateHash } from '../Utils';

// Auth Interface
export interface IAuthSchema {
  _id?:          string;     // Unique Entry ID

  // Basic Information
  email:        string,
  password:     string,
}

export const AuthObjectSchema = Joi.object({
  _id: Joi.string()
    .optional()
    .default(generateHash()),

  email: Joi.string()
    .required()
    .email(),

  password: Joi.string()
    .required()
    .min(6)
    .max(255)
});
