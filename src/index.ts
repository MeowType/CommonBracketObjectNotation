import { parser as raw_parser  } from "./parser";
import { toJsObj } from "./toJsObj";
import { CbonObj, CbonArr } from "./type";
import { Docs } from "./ast";
import { getErrorsMsgs } from "./utils";

export function parser(code: string, confg?: { alwaysDocs: false, show_all_err: boolean }): CbonObj | CbonArr
export function parser(code: string, confg: { alwaysDocs: true, show_all_err: boolean }): (CbonObj | CbonArr)[]
export function parser(code: string, confg?: { alwaysDocs: boolean, show_all_err: boolean }): CbonObj | CbonArr | (CbonObj | CbonArr)[] {
    const r = raw_parser(code, confg?.show_all_err ?? false)
    if (!(r instanceof Docs)) {
        const msgs = getErrorsMsgs(r)
        throw new SyntaxError(`\n    ${msgs.join('\n    ')}\n`)
    }
    const o = toJsObj(r)
    if (confg?.alwaysDocs) return o
    if (o.length == 1) {
        return o[0]
    } else return o
}