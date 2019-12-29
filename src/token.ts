import { TkRange } from "./pos"

export abstract class Token { }
export class TEOF extends Token { 
    range: TkRange
    constructor(range: TkRange) {
        super()
        this.range = range
    }
}
export abstract class TComment extends Token { }
export class TLineComment extends TComment {
    items: (string | TComments)[]
    range: TkRange
    constructor(range: TkRange, items: (string | TComments)[]) {
        super()
        this.items = items
        this.range = range
    }
}
export class TBlockComment extends TComment {
    items: (string | TComments)[]
    range: TkRange
    constructor(range: TkRange, items: (string | TComments)[]) {
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
export abstract class TSymbol<S extends ',' | ':' | '=' | '[' | ']' | '{' | '}'> extends Token {
    val: S
    range: TkRange
    constructor(range: TkRange, val: S) {
        super()
        this.val = val
        this.range = range
    }
}
export class TSComma extends TSymbol<','> { }
export class TSSplit extends TSymbol<':' | '='> { }
export class TSArrStart extends TSymbol<'['> { }
export class TSArrEnd extends TSymbol<']'> { }
export class TSObjStart extends TSymbol<'{'> { }
export class TSObjEnd extends TSymbol<'}'> { }

export function makeTSymbol(range: TkRange, val: ','): TSComma
export function makeTSymbol(range: TkRange, val: ':' | '='): TSSplit
export function makeTSymbol(range: TkRange, val: '['): TSArrStart
export function makeTSymbol(range: TkRange, val: ']'): TSArrEnd
export function makeTSymbol(range: TkRange, val: '{'): TSObjStart
export function makeTSymbol(range: TkRange, val: '{'): TSObjEnd
export function makeTSymbol(range: TkRange, val: ',' | ':' | '=' | '[' | ']' | '{' | '}'): TSComma | TSSplit | TSArrStart | TSArrEnd | TSObjStart | TSObjEnd
export function makeTSymbol(range: TkRange, val: ',' | ':' | '=' | '[' | ']' | '{' | '}') {
    switch (val) {
        case ',': return new TSComma(range, val)
        case ':': case '=': return new TSSplit(range, val)
        case '[': return new TSArrStart(range, val)
        case ']': return new TSArrEnd(range, val)
        case '{': return new TSObjStart(range, val)
        case '}': return new TSObjEnd(range, val)
    }
}

export type TComments = TLineComment | TBlockComment
export type Tokens = TEOF | TComments | TWord | TStr | TSComma | TSSplit | TSArrStart | TSArrEnd | TSObjStart | TSObjEnd