import { Docs, Block, Arr, Units, Key, Str, Num, Bool, Null, Comma, LineComment, BlockComment } from "./ast";
import { CbonVal, CbonObj, CbonArr } from "./type";

export function toJsObj(doc: Docs) {
    return doc.items.flatMap<CbonObj | CbonArr>(u => {
        if (u instanceof Block) return [block(u)]
        else if (u instanceof Arr) return [arr(u)]
        else return []
    })
}

export function unit(u: Units): CbonVal | undefined {
    if (u instanceof Block) return block(u)
    else if (u instanceof Arr) return arr(u)
    else if (u instanceof Num) return u.val
    else if (u instanceof Str) return u.val
    else if (u instanceof Bool) return u.val
    else if (u instanceof Null) return null
    else return undefined
}

function key(k: Key) {
    return k.key instanceof Str ? k.key.val : k.key
}

export function block(b: Block): CbonObj {
    return Object.fromEntries(b.items.flatMap(kv => {
        if (kv instanceof Comma) return []
        const v = unit(kv.val)
        if (v === undefined) return []
        return [[key(kv.key), v]]
    }))
}

export function arr(a: Arr): CbonArr {
    return a.items.flatMap(u => {
        const v = unit(u)
        if (v === undefined) return []
        return [v]
    })
}