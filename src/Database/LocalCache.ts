import {
  IItemSchema,
  IUserSchema,
} from '../Database';


// ListSchema Key Value Pair
export interface IItemSchemaPair {
  [id: string]: IItemSchema,
}

// Cache Iterface
export interface Cache {
  list: IItemSchemaPair | null,
  lastUpdated: number | null,
  users: { [email: string]: IUserSchema},
}
