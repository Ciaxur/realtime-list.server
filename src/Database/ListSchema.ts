import * as Joi from 'joi';


// Item Listing Interface
export interface IListSchema {
  _id:          string;     // MongoDB Hash ID

  // Basic Information
  image?:       string;     // Base64 Image
  count:        number;     // Quantity of Item
  color:        string;     // Color Identifier for Item
  name:         string;     // Item's Name
  description:  string;     // Item's Description Summary

  // Removal Tracking
  dateDeleted:  Date;       // Date of Removal
  isDeleted:    boolean;    // State of Removal
}


// Item Listing JOI Schema
export const ListObjectSchema = Joi.object({
  _id: Joi.string()
    .required(),

  image: Joi.string()
    .optional(),
  
  count: Joi.number()
    .integer()
    .min(1)
    .max(99)
    .required(),

  color: Joi.string()
    .required(),

  name: Joi.string()
    .required(),
  
  description: Joi.string()
    .required(),


  // Removal Tracking Information
  dateDeleted: Joi.date()
    .optional(),
  
  isDeleted: Joi.boolean()
    .optional(),
})