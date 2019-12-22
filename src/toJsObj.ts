import { Docs, Block, Arr, Unit, Key, Str, Num, Bool, Null } from "./ast";
import { CbonVal, CbonObj, CbonArr } from "./type";

export function toJsObj(doc: Docs) {
    return doc.items.map(u => {
        if (u instanceof Block) return block(u)
        else return arr(u)
    })
}

export function unit(u: Unit): CbonVal {
    if (u instanceof Block) return block(u)
    else if (u instanceof Arr) return arr(u)
    else if (u instanceof Num) return u.val
    else if (u instanceof Str) return u.val
    else if (u instanceof Bool) return u.val
    else return null
}

function key(k: Key) {
    return k.key instanceof Str ? k.key.val : k.key
}

export function block(b: Block): CbonObj {
    return Object.fromEntries(b.items.map(kv => [key(kv.key), unit(kv.val)]))
}

export function arr(a: Arr): CbonArr {
    return a.items.map(u => unit(u))
}