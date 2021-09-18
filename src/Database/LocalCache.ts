import { IListSchema} from "./ListSchema";
import { IAuthSchema } from '../Database';


// ListSchema Key Value Pair
export interface IListSchemaPair {
  [id: string]: IListSchema,
}

// Cache Iterface
export interface Cache {
  list: IListSchemaPair | null,
  lastUpdated: number | null,
  users: { [email: string]: IAuthSchema},
}
