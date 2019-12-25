import { TkRange } from "./pos"

export abstract class Token { }
export class TEOF extends Token { }
export abstract class TComment extends Token { }
export class TLineComment extends TComment {
    items: (string | Comment)[]
    range: TkRange
    constructor(range: TkRange, items: (string | Comment)[]) {
        super()
        this.items = items
        this.range = range
    }
}
export class TBlockComment extends TComment {
    items: (string | Comment)[]
    range: TkRange
    constructor(range: TkRange, items: (string | Comment)[]) {
        super()
        this.items = items
        this.range = range
    }
}
export class TWord extends Token {
    val: string
    range: TkRange
    constructor(range: TkRange, val: string) {
        super()
        this.val = val
        this.range = range
    }
}
export class TStr extends Token {
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
export class TNum extends Token {
    val: number
    range: TkRange
    constructor(range: TkRange, val: number) {
        super()
        this.val = val
        this.range = range
    }
}
export class TSymbol extends Token {
    val: ',' | ':' | '=' | '[' | ']' | '{' | '}'
    range: TkRange
    constructor(range: TkRange, val: ',' | ':' | '=' | '[' | ']' | '{' | '}') {
        super()
        this.val = val
        this.range = range
    }
}

export type Tokens = TEOF | TLineComment | TBlockComment | TWord | TStr | TNum | TSymbol