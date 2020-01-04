import { TkRange } from "./pos"
import { TLineComment, TComments, TBlockComment } from "./token"

function MakeCommentItem(items: (string | Comment | TComments)[]): (string | Comment)[] {
    return items.map(i => i instanceof TLineComment ? new LineComment(i.range, i.items) : i instanceof TBlockComment ? new BlockComment(i.range, i.items) : i)
}

export abstract class Unit { }
export abstract class Comment extends Unit { }
export class LineComment extends Comment {
    items: (string | Comment)[]
    range: TkRange
    constructor(range: TkRange, items: (string | TComments)[])
    constructor(range: TkRange, items: (string | Comment)[])
    constructor(range: TkRange, items: (string | Comment | TComments)[]) {
        super()
        this.items = MakeCommentItem(items)
        this.range = range
    }
}
export class BlockComment extends Comment {
    items: (string | Comment)[]
    range: TkRange
    constructor(range: TkRange, items: (string | TComments)[])
    constructor(range: TkRange, items: (string | Comment)[])
    constructor(range: TkRange, items: (string | Comment | TComments)[]) {
        super()
        this.items = MakeCommentItem(items)
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
    col: '"' | "'" | null
    range: TkRange
    constructor(range: TkRange, val: string, col: '"' | "'" | null) {
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
    val: Units
    split?: Split
    constructor(key: Key, val: Units, split?: Split) {
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
    items: Units[]
    begin: TkRange
    end: TkRange
    constructor(begin: TkRange, end: TkRange, items: Units[]) {
        super()
        this.items = items
        this.begin = begin
        this.end = end
    }
}
export class Docs extends Unit {
    items: (Block | Arr | Comments)[]
    constructor(items: (Block | Arr | Comments)[]) {
        super()
        this.items = items
    }
}

export type Comments = LineComment | BlockComment
export type Asts = Block | Arr | Bool | Num | Str | Null
export type Units = Asts | Comma | Comments