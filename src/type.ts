import { TkRange } from "./pos"

export type CbonVal = number | string | boolean | null | CbonObj | CbonArr
export type CbonObj = { [key: string]: CbonVal }
export type CbonArr = CbonVal[]

export type Errors = { range: TkRange, msg: string }