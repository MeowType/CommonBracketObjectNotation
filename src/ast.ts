import { TkRange } from "./pos"

export abstract class Unit { }
export class Null extends Unit {}
export class Str extends Unit {
    val: string
    col: '"' | "'"
    range: TkRange
    constructor(range: TkRange, val: string, col: '"' | "'") {
        super()
        this.val = val
        this.col = col
        this.range = range
    }
}
export class Num extends Unit {
    val: number
    range: TkRange
    constructor(range: TkRange, val: number) {
        super()
        this.val = val
        this.range = range
    }
}
export class Bool extends Unit {
    val: boolean
    range: TkRange
    constructor(range: TkRange, val: boolean) {
        super()
        this.val = val
        this.range = range
    }
}
export class Key {
    key: string | Str
    range: TkRange
    constructor(range: TkRange, key: string | Str) {
        this.key = key
        this.range = range
    }
}
export class KeyVal {
    key: Key
    val: Unit
    constructor(key: Key, val: Unit) {
        this.key = key
        this.val = val
    }
}
export class Block extends Unit {
    items: KeyVal[]
    begin: TkRange
    end: TkRange
    constructor(begin: TkRange, end: TkRange, items: KeyVal[]) {
        super()
        this.items = items
        this.begin = begin
        this.end = end
    }
}
export class Arr extends Unit {
    items: Unit[]
    begin: TkRange
    end: TkRange
    constructor(begin: TkRange, end: TkRange, items: Unit[]) {
        super()
        this.items = items
        this.begin = begin
        this.end = end
    }
}
export class Docs extends Unit {
    items: (Block | Arr)[]
    constructor(items: (Block | Arr)[]) {
        super()
        this.items = items
    }
}