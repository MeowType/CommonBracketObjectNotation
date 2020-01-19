import { TkRange } from "./pos"

export type CbonVal = number | string | boolean | null | CbonObj | CbonArr
export type CbonObj = { [key: string]: CbonVal }
export type CbonArr = CbonVal[]

export type TailParams<T extends (...a: any[]) => any> = T extends (_: any, ...a: infer L) => any ? L : never

export type Errors = { range: TkRange, msg: string }