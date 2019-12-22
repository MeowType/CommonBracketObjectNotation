import { parser as raw_parser  } from "./parser";
import { toJsObj } from "./toJsObj";
import { CbonObj, CbonArr } from "./type";

export function parser(code: string): CbonObj | CbonArr
export function parser(code: string, confg: { alwaysDocs: true }): (CbonObj | CbonArr)[]
export function parser(code: string, confg?: { alwaysDocs: boolean }): CbonObj | CbonArr | (CbonObj | CbonArr)[] {
    const r = raw_parser(code)
    const o = toJsObj(r)
    if (confg?.alwaysDocs) return o
    if (o.length == 1) {
        return o[0]
    } else return o
}