import IListSchema from "./ListSchema";


// ListSchema Key Value Pair
export interface IListSchemaPair {
  [id: string]: IListSchema,
}

// Cache Iterface
export interface Cache {
  list: IListSchemaPair | null,
  lastUpdated: number | null,
}
