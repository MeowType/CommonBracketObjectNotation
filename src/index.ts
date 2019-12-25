import { parser as raw_parser  } from "./parser";
import { toJsObj } from "./toJsObj";
import { CbonObj, CbonArr } from "./type";
import { Docs } from "./ast";
import { getErrorsMsgs } from "./utils";
import { tokenizer } from "./tokenizer";

export function parser(code: string, confg?: { alwaysDocs: false, show_all_err: boolean }): CbonObj | CbonArr
export function parser(code: string, confg: { alwaysDocs: true, show_all_err: boolean }): (CbonObj | CbonArr)[]
export function parser(code: string, confg?: { alwaysDocs: boolean, show_all_err: boolean }): CbonObj | CbonArr | (CbonObj | CbonArr)[] {
    const t = tokenizer(code, confg?.show_all_err ?? false)
    const errmsg: string[] = []
    if (t.err != null && t.err.length !== 0) {
        errmsg.push(...getErrorsMsgs(t.err))
    }
    if (!(confg?.show_all_err ?? false) && errmsg.length !== 0) {
        throw new SyntaxError(`\n    ${errmsg.join('\n    ')}\n`)
    }
    const r = raw_parser(t.val, confg?.show_all_err ?? false)
    if (!(r instanceof Docs)) {
        errmsg.push(...getErrorsMsgs(r))
    }
    if (errmsg.length !== 0) {
        throw new SyntaxError(`\n    ${errmsg.join('\n    ')}\n`)
    }
    const o = toJsObj(r as Docs)
    if (confg?.alwaysDocs) return o
    if (o.length == 1) {
        return o[0]
    } else return o
}