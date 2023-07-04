import * as Joi from 'joi';
import mongoose, { Schema, model } from 'mongoose';
import { IUserSchema } from './User.model';

// User Item Interface
export interface IItemSchema {
  _id:          string;     // MongoDB Hash ID

  // User Foreign key, associated with this item.
  userId:       IUserSchema,

  // Basic Information
  image?:       string;     // Base64 Image
  count:        number;     // Quantity of Item
  color:        string;     // Color Identifier for Item
  name:         string;     // Item's Name
  description:  string;     // Item's Description Summary

  // Entry tracking information.
  createdAt:    Date;       // Creation date of the entry.
  updatedAt:    Date;       // Update date of the entry.

  // Removal Tracking
  deletedAt:    Date;       // Date of Removal
  isDeleted:    boolean;    // State of Removal
}


// User Item JOI Schema
export const ItemSchemaValdator = Joi.object({
  _id: Joi.string()
    .optional(),

  image: Joi.string()
    .optional(),

  count: Joi.number()
    .integer()
    .min(1)
    .max(99)
    .required(),

  color: Joi.string()
    .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
    .required(),

  name: Joi.string()
    .required(),

  description: Joi.string()
    .required(),

  // Removal Tracking Information
  deletedAt: Joi.date().optional(),
  isDeleted: Joi.boolean().optional(),
});

// Create MongoDB schema.
const ItemSchema = new Schema<IItemSchema>({
  // User Foreign key, associated with this item.
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  image: { type: String, required: false },
  count: { type: Number, required: true},
  color: { type: String, required: true },
  name:  { type: String, required: true },
  description: { type: String, required: true },

  // Timestamps.
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  deletedAt: { type: Date, required: false },
  isDeleted: { type: Boolean, required: false, default: false },
}, {
  timestamps: true,
});

export const ItemModel = model('Item', ItemSchema);