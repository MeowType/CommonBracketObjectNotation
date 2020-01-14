import { parser as raw_parser  } from "./parser";
import { toJsObj } from "./toJsObj";
import { CbonObj, CbonArr } from "./type";
import { Docs } from "./ast";
import { getErrorsMsgs } from "./utils";
import { tokenizer } from "./tokenizer";
import { WhenError } from "./state_machine";
import { Canceller, AsyncCanceller, AlwaysFalse } from "./canceller";

export function parser(code: string, confg: { alwaysDocs?: false, show_all_err?: boolean, async: true, cancel?: Canceller | AsyncCanceller }): Promise<CbonObj | CbonArr>
export function parser(code: string, confg: { alwaysDocs: true, show_all_err?: boolean, async: true, cancel?: Canceller | AsyncCanceller }): Promise<(CbonObj | CbonArr)[]>
export function parser(code: string, confg?: { alwaysDocs?: false, show_all_err?: boolean, async?: false, cancel?: Canceller }): CbonObj | CbonArr
export function parser(code: string, confg: { alwaysDocs: true, show_all_err?: boolean, async?: false, cancel?: Canceller }): (CbonObj | CbonArr)[]
export function parser(code: string, confg?: { alwaysDocs?: boolean, show_all_err?: boolean, async?: boolean, cancel?: Canceller | AsyncCanceller }): (CbonObj | CbonArr) | (CbonObj | CbonArr)[] | Promise<CbonObj | CbonArr> | Promise<(CbonObj | CbonArr)[]>
export function parser(code: string, confg?: { alwaysDocs?: boolean, show_all_err?: boolean, async?: boolean, cancel?: Canceller | AsyncCanceller }): (CbonObj | CbonArr) | (CbonObj | CbonArr)[] | Promise<CbonObj | CbonArr> | Promise<(CbonObj | CbonArr)[]> {
    const cancel = confg?.cancel ?? AlwaysFalse
    let isCancel = false
    const errmsg: string[] = []
    
    let root: Docs

    function* main(cancel: Canceller | AsyncCanceller) {
        try {
            const r = yield raw_parser(yield tokenizer(code, {
                show_all_err: confg?.show_all_err ?? false,
                iterable: true,
                async: confg?.async ?? false,
                cancel: cancel
            }), {
                show_all_err: confg?.show_all_err ?? false, 
                async: confg?.async ?? false,
                cancel: cancel
            })
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

        if(yield/** is cancel */) return null

        const o = toJsObj(root!)
        if (confg?.alwaysDocs ?? false) return o
        if (o.length == 1) {
            return o[0]
        } else return o
    }
    
    const def = confg?.async ? async function () {
        async function Cancel() {
            if (!isCancel) isCancel = await cancel()
            return isCancel
        }
        const g = main(Cancel)
        g.next(await g.next(await g.next().value as any).value as any)
        return g.next(await Cancel() as any).value as (CbonObj | CbonArr) | (CbonObj | CbonArr)[]
    } : function () {
        function Cancel() {
            if (!isCancel) isCancel = cancel() as boolean
            return isCancel
        }
        const g = main(Cancel) 
        g.next(g.next(g.next().value as any).value as any)
        return g.next(Cancel() as any).value as (CbonObj | CbonArr) | (CbonObj | CbonArr)[]
    }
    
    return def()
}