import { TkRange } from "./pos"

export abstract class Unit { }
export abstract class Comment extends Unit { }
export class LineComment extends Comment {
    items: (string | Comment)[]
    range: TkRange
    constructor(range: TkRange, items: (string | Comment)[]) {
        super()
        this.items = items
        this.range = range
    }
}
export class BlockComment extends Comment {
    items: (string | Comment)[]
    range: TkRange
    constructor(range: TkRange, items: (string | Comment)[]) {
        super()
        this.items = items
        this.range = range
    }
}
export class Comma extends Unit {
    range: TkRange
    constructor(range: TkRange) {
        super()
        this.range = range
    }
}
export class Null extends Unit {
    range: TkRange
    constructor(range: TkRange) {
        super()
        this.range = range
    }
}
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
export class Split {
    type: ':' | '='
    range: TkRange
    constructor(range: TkRange, type: ':' | '=') {
        this.type = type
        this.range = range
    }
}
export class KeyVal {
    key: Key
    val: Unit
    split?: Split
    constructor(key: Key, val: Unit, split?: Split) {
        this.key = key
        this.val = val
        this.split = split
    }
}
export class Block extends Unit {
    items: (KeyVal | Comma)[]
    begin: TkRange
    end: TkRange
    constructor(begin: TkRange, end: TkRange, items: (KeyVal | Comma)[]) {
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