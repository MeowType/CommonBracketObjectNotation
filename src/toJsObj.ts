import { Docs, Block, Arr, Units, Key, Str, Num, Bool, Null, Comma } from "./ast";
import { CbonVal, CbonObj, CbonArr } from "./type";
import { RecursiveCtx, doRecursive, Gen, doRecursiveAsync } from "./recursive";

export function toJsObj(doc: Docs, config: { async: true }): Promise<(CbonObj | CbonArr)[]>
export function toJsObj(doc: Docs, config?: { async?: false }): (CbonObj | CbonArr)[]
export function toJsObj(doc: Docs, config?: { async?: boolean }): Promise<(CbonObj | CbonArr)[]> | (CbonObj | CbonArr)[]
export function toJsObj(doc: Docs, config: { async?: boolean } = { async: false }): Promise<(CbonObj | CbonArr)[]> | (CbonObj | CbonArr)[] {
    return config?.async ? doRecursiveAsync(root, doc) : doRecursive(root, doc)
}

function* root(ctx: RecursiveCtx, doc: Docs) {
    const cs: (CbonObj | CbonArr)[] = []
    for (const u of doc.items) {
        if (u instanceof Block) {
            cs.push(yield ctx.call(block, u))
        }
        else if (u instanceof Arr) {
            cs.push(yield ctx.call(arr, u))
        }
    }
    return cs
}

function* unit(ctx: RecursiveCtx, u: Units): Gen<CbonVal | undefined> {
    if (u instanceof Block) return yield ctx.call(block, u)
    else if (u instanceof Arr) return yield ctx.call(arr, u)
    else if (u instanceof Num) return u.val
    else if (u instanceof Str) return u.val
    else if (u instanceof Bool) return u.val
    else if (u instanceof Null) return null
    else return undefined
}

function key(k: Key) {
    return k.key instanceof Str ? k.key.val : k.key
}

function* block(ctx: RecursiveCtx, b: Block) {
    const kvs: [string, CbonVal][] = []
    for (const kv of b.items) {
        if (kv instanceof Comma) continue
        const v = yield ctx.call(unit, kv.val)
        if (v !== undefined) kvs.push([key(kv.key), v])
    }
    return Object.fromEntries(kvs) as CbonObj
}

function* arr(ctx: RecursiveCtx, a: Arr) {
    const ars: CbonArr = []
    for (const u of a.items) {
        const v = yield ctx.call(unit, u)
        if (v !== undefined) ars.push(v)
    }
    return ars
}