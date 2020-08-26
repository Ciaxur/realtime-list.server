import * as Joi from 'joi';


// Item Listing Interface
export default interface IListSchema {
  _id:          string;     // MongoDB Hash ID
  image?:       string;     // Base64 Image
  count:        number;     // Quantity of Item
  name:         string;     // Item's Name
  description:  string;     // Item's Description Summary
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

  name: Joi.string()
    .required(),
  
  description: Joi.string()
    .required(),
})