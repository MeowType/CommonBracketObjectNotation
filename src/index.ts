import { parser as raw_parser  } from "./parser";
import { toJsObj } from "./toJsObj";
import { CbonObj, CbonArr } from "./type";
import { Docs } from "./ast";
import { getErrorsMsgs } from "./utils";
import { tokenizer } from "./tokenizer";
import { WhenError } from "./state_machine";
import { Canceller, AsyncCanceller, AlwaysFalse } from "./canceller";

export function parser(code: string, config: { alwaysDocs?: false, show_all_err?: boolean, async: true, cancel?: Canceller | AsyncCanceller }): Promise<CbonObj | CbonArr>
export function parser(code: string, config: { alwaysDocs: true, show_all_err?: boolean, async: true, cancel?: Canceller | AsyncCanceller }): Promise<(CbonObj | CbonArr)[]>
export function parser(code: string, config?: { alwaysDocs?: false, show_all_err?: boolean, async?: false, cancel?: Canceller }): CbonObj | CbonArr
export function parser(code: string, config: { alwaysDocs: true, show_all_err?: boolean, async?: false, cancel?: Canceller }): (CbonObj | CbonArr)[]
export function parser(code: string, config?: { alwaysDocs?: boolean, show_all_err?: boolean, async?: boolean, cancel?: Canceller | AsyncCanceller }): (CbonObj | CbonArr) | (CbonObj | CbonArr)[] | Promise<CbonObj | CbonArr> | Promise<(CbonObj | CbonArr)[]>
export function parser(code: string, config?: { alwaysDocs?: boolean, show_all_err?: boolean, async?: boolean, cancel?: Canceller | AsyncCanceller }): (CbonObj | CbonArr) | (CbonObj | CbonArr)[] | Promise<CbonObj | CbonArr> | Promise<(CbonObj | CbonArr)[]> {
    const cancel = config?.cancel ?? AlwaysFalse
    const show_all_err = config?.show_all_err ?? false
    const async = config?.async ?? false
    let isCancel = false
    const errmsg: string[] = []
    
    let root: Docs

    function* main(cancel: Canceller | AsyncCanceller) {
        try {
            const r = yield raw_parser(yield tokenizer(code, {
                show_all_err,
                iterable: true,
                async,
                cancel
            }), {
                show_all_err, 
                async,
                cancel
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

        const o = yield toJsObj(root!, { async })
        if (config?.alwaysDocs ?? false) return o
        if (o.length == 1) {
            return o[0]
        } else return o
    }
    
    const def = config?.async ? async function () {
        async function Cancel() {
            if (!isCancel) isCancel = await cancel()
            return isCancel
        }
        const g = main(Cancel)
        g.next(await g.next(await g.next().value).value)
        return g.next(await g.next(await Cancel() as any).value).value as (CbonObj | CbonArr) | (CbonObj | CbonArr)[]
    } : function () {
        function Cancel() {
            if (!isCancel) isCancel = cancel() as boolean
            return isCancel
        }
        const g = main(Cancel) 
        g.next(g.next(g.next().value).value)
        return g.next(g.next(Cancel() as any).value).value as (CbonObj | CbonArr) | (CbonObj | CbonArr)[]
    }
    
    return def()
}