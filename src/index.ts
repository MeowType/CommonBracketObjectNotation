import { parser as raw_parser  } from "./parser";
import { toJsObj } from "./toJsObj";
import { CbonObj, CbonArr } from "./type";
import { Docs } from "./ast";
import { getErrorsMsgs } from "./utils";
import { tokenizer } from "./tokenizer";
import { WhenError } from "./state_machine";

export function parser(code: string, confg?: { alwaysDocs: false, show_all_err?: boolean }): CbonObj | CbonArr
export function parser(code: string, confg: { alwaysDocs: true, show_all_err?: boolean }): (CbonObj | CbonArr)[]
export function parser(code: string, confg?: { alwaysDocs?: boolean, show_all_err?: boolean }): CbonObj | CbonArr | (CbonObj | CbonArr)[]
export function parser(code: string, confg?: { alwaysDocs?: boolean, show_all_err?: boolean }): CbonObj | CbonArr | (CbonObj | CbonArr)[] {
    const errmsg: string[] = []
    try {
        const r = raw_parser(tokenizer(code, confg?.show_all_err ?? false, true, false), confg?.show_all_err ?? false, false)
        if (!(r instanceof Docs)) {
            errmsg.push(...getErrorsMsgs(r))
        }
    } catch (e) {
        if (e instanceof WhenError) {
            errmsg.push(e.err.msg)
        } else throw e
    }

    if (errmsg.length !== 0) {
        throw new SyntaxError(`\n    ${errmsg.join('\n    ')}\n`)
    }
    const o = toJsObj(r as Docs)
    if (confg?.alwaysDocs ?? false) return o
    if (o.length == 1) {
        return o[0]
    } else return o
}