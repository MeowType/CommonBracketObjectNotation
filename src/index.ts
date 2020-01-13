import { parser as raw_parser  } from "./parser";
import { toJsObj } from "./toJsObj";
import { CbonObj, CbonArr } from "./type";
import { Docs } from "./ast";
import { getErrorsMsgs } from "./utils";
import { tokenizer } from "./tokenizer";
import { WhenError } from "./state_machine";

export function parser(code: string, confg: { alwaysDocs?: false, show_all_err?: boolean, async: true }): Promise<CbonObj | CbonArr>
export function parser(code: string, confg: { alwaysDocs: true, show_all_err?: boolean, async: true }): Promise<(CbonObj | CbonArr)[]>
export function parser(code: string, confg?: { alwaysDocs?: false, show_all_err?: boolean, async?: false }): CbonObj | CbonArr
export function parser(code: string, confg: { alwaysDocs: true, show_all_err?: boolean, async?: false }): (CbonObj | CbonArr)[]
export function parser(code: string, confg?: { alwaysDocs?: boolean, show_all_err?: boolean, async?: boolean }): (CbonObj | CbonArr) | (CbonObj | CbonArr)[] | Promise<CbonObj | CbonArr> | Promise<(CbonObj | CbonArr)[]>
export function parser(code: string, confg?: { alwaysDocs?: boolean, show_all_err?: boolean, async?: boolean }): (CbonObj | CbonArr) | (CbonObj | CbonArr)[] | Promise<CbonObj | CbonArr> | Promise<(CbonObj | CbonArr)[]> {
    const errmsg: string[] = []
    
    let root: Docs

    function* main() {
        try {
            const r = yield raw_parser(yield tokenizer(code, confg?.show_all_err ?? false, true, confg?.async ?? false), confg?.show_all_err ?? false, confg?.async ?? false)
            if (r.err != null) {
                errmsg.push(...getErrorsMsgs(r.err))
            }
            root = r.val
        } catch (e) {
            if (e instanceof WhenError) {
                errmsg.push(e.err.msg)
            } else throw e
        }

        if (errmsg.length !== 0) {
            throw new SyntaxError(`\n    ${errmsg.join('\n    ')}\n`)
        }

        const o = toJsObj(root!)
        if (confg?.alwaysDocs ?? false) return o
        if (o.length == 1) {
            return o[0]
        } else return o
    }
    
    const def = confg?.async ? async function () {
        const g = main()
        return g.next(await g.next(await g.next().value as any).value as any).value as (CbonObj | CbonArr) | (CbonObj | CbonArr)[]
    } : function () {
        const g = main() 
        return g.next(g.next(g.next().value as any).value as any).value as (CbonObj | CbonArr) | (CbonObj | CbonArr)[]
    }
    
    return def()
}