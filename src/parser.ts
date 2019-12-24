import { Unit, Block, KeyVal, Arr, Key, Num, Str, Bool, Null, Docs } from "./ast";
import { isVoid } from "./utils";
import { TkPos, TkRange } from "./pos";
import { Errors } from "./type";

type TailParams<T extends (...a: any[]) => any> = T extends (_: any, ...a: infer L) => any ? L : never

const EOF = Symbol('EOF')
type char = string | typeof EOF
const ReDo = Symbol('ReDo')
type BaseParserUnit = (c: char) => void | typeof ReDo | ParserUnit
type ParserUnitFn = (ctx: Context, ...a: any[]) => BaseParserUnit
interface ParserUnit {
    fn: BaseParserUnit
    ignoreFirst: boolean
}

const reg_Space = /\s/
const reg_Num = /(\d|_)/

class State {
    count = 0
    char = 0
    line = 0
    states: BaseParserUnit[] = []
    lines: number[] = []
    errors: Errors[] = []
    push(unit: BaseParserUnit) {
        this.states.push(unit)
    }
    pop() {
        return this.states.pop()
    }
    call(c: char): void {
        const r = this.states[this.states.length - 1](c)
        if (c === EOF && this.states.length > 1) {
            this.pop()
            this.call(c)
            return
        }
        if (!isVoid(r)) {
            if (r === ReDo) {
                this.call(c)
            } else {
                const { fn, ignoreFirst} = r
                this.push(fn)
                if (!ignoreFirst) this.call(c)
            }
        }
    }
    get pos() {
        return new TkPos(this.count, this.char, this.line)
    }
    get lastPos() {
        const np = new TkPos(this.count, this.char, this.line)
        np.count--
        if (np.char === 0) {
            np.line--
            np.char = this.lines[np.line]
        } else np.char--
        return np
    }
}

class Context {
    state: State
    last_flag?: TkPos
    constructor(state: State) {
        this.state = state
    }
    end() {
        this.state.pop()
    }
    call<F extends ParserUnitFn>(f: F, ...p: TailParams<F>): ParserUnit {
        return {
            fn: f(new Context(this.state), ...p),
            ignoreFirst: false
        }
    }
    callNoFirst<F extends ParserUnitFn>(f: F, ...p: TailParams<F>): ParserUnit {
        return {
            fn: f(new Context(this.state), ...p),
            ignoreFirst: true
        }
    }
    flag() {
        this.last_flag = this.state.pos
    }
    range(last: boolean = false) {
        const n = last ? this.state.lastPos : this.state.pos 
        return new TkRange(this.last_flag ?? n, n)
    }
    error(range: TkRange, msg: string) {
        this.state.errors.push({ range, msg })
    }
}

export function parser(code: string) {
    const state = new State
    let rootAst: Docs
    state.push(root(new Context(state), (d) => {
        rootAst = d
    }))
    let last: null | '\r' | '\n' = null
    for (const c of code) {
        state.call(c)
        state.count++
        if (c === '\n') {
            if (last !== '\r') {
                state.lines[state.line] = state.char
                state.line++
                state.char = 0
            }
            last = null
        } else if (c === '\r') {
            state.lines[state.line] = state.char
            state.line++
            state.char = 0
            last = '\r'
        } else {
            state.char++
            last = null
        }
    }
    state.call(EOF)
    if (state.errors.length !== 0) {
        return state.errors
    }
    return rootAst!
}

function root(ctx: Context, finish: (docs: Docs) => void) {
    const items: (Block | Arr)[] = []
    let errchar: boolean = false
    return (c: char) => {
        if (c === EOF) {
            if (errchar) {
                ctx.error(ctx.range(true), 'File root must have no content other than a document')
                errchar = false
            }
            finish(new Docs(items))
        } else if (c === '{') {
            if (errchar) {
                ctx.error(ctx.range(true), 'File root must have no content other than a document')
                errchar = false
            }
            return ctx.callNoFirst(block, b => items.push(b as any))
        } else if (c === '[') {
            if (errchar) {
                ctx.error(ctx.range(true), 'File root must have no content other than a document')
                errchar = false
            }
            return ctx.callNoFirst(arr, a => items.push(a as any))
        } else {
            if (!errchar) {
                ctx.flag()
            }
            errchar = true
        }
    }
}


function block(ctx: Context, finish: (block: Block) => void) {
    const items: KeyVal[] = []
    ctx.flag()
    const begin = ctx.range()
    return (c: char) => {
        if (c === EOF) {
            ctx.flag()
            ctx.error(ctx.range(), 'Block is not closed')
        } else if (reg_Space.test(c) || c === ',') {
            return
        } else if (c === '}') {
            ctx.flag()
            const end = ctx.range()
            ctx.end()
            finish(new Block(begin, end, items))
            return
        } else if (c === ':' || c === '=') {
            ctx.flag()
            ctx.error(ctx.range(), 'Block content must start with a key')
        } else if (c === '[') {
            ctx.flag()
            ctx.error(ctx.range(), 'Block content must start with a key')
            return ctx.callNoFirst(arr, _ => { })
        } else if (c === '{' ) {
            ctx.flag()
            ctx.error(ctx.range(), 'Block content must start with a key')
            return ctx.callNoFirst(block, _ => { })
        } else if (c === ']') {
            ctx.flag()
            ctx.error(ctx.range(), 'Block is not closed')
            ctx.end()
            return ReDo
        } else {
            return ctx.call(key, kv => {
                items.push(kv)
            })
        }
    }
}

function arr(ctx: Context, finish: (block: Arr) => void) {
    const items: Unit[] = []
    ctx.flag()
    const begin = ctx.range()
    return (c: char) => { 
        if (c === EOF) {
            ctx.flag()
            ctx.error(ctx.range(), 'Array is not closed')
        } else if (c === ':' || c === '=') {
            ctx.flag()
            ctx.error(ctx.range(), 'Array cant have key')
        } else if (reg_Space.test(c) || c === ',') {
            return
        } else if (c === ']') {
            ctx.flag()
            const end = ctx.range()
            ctx.end()
            finish(new Arr(begin, end, items))
            return
        } else if (c === '{') {
            return ctx.callNoFirst(block, b => items.push(b))
        } else if (c === '[') {
            return ctx.callNoFirst(arr, a => items.push(a))
        } else {
            return ctx.call(val, u => {
                items.push(u)
            })
        }
    }
}

function key(ctx: Context, finish: (kv: KeyVal) => void) {
    const chars: string[] = []
    let s: Str | null = null
    ctx.flag()
    return (c: char) => {
        if (c === EOF) {
            ctx.flag()
            ctx.error(ctx.range(), 'There should be a key value here')
        } else if (s != null) {
            return ctx.call(val, v => {
                const k = new Key(ctx.range(), s!)
                const kv = new KeyVal(k, v)
                ctx.end()
                finish(kv)
            })
        } else if (c === '"' || c === "'") {
            if (chars.length !== 0 || s != null) {
                return ctx.callNoFirst(str, c, s => {
                    const k = new Key(ctx.range(), chars.join(''))
                    const kv = new KeyVal(k, s)
                    ctx.end()
                    finish(kv)
                })
            }
            return ctx.callNoFirst(str, c, s => {
                s = s
            })
        } else if (reg_Space.test(c) || c === ':' || c === '=') {
            if (chars.length === 0) {
                ctx.error(ctx.range(), 'No key here')
            }
            return ctx.callNoFirst(val, v => {
                const k = new Key(ctx.range(), chars.join(''))
                const kv = new KeyVal(k, v)
                ctx.end()
                finish(kv)
            })
        } else if (c === '{') {
            if (chars.length === 0) {
                ctx.error(ctx.range(), 'No key here')
            }
            return ctx.callNoFirst(block, b => {
                const k = new Key(ctx.range(), chars.join(''))
                const kv = new KeyVal(k, b)
                ctx.end()
                finish(kv)
            })
        } else if (c === '[') {
            if (chars.length === 0) {
                ctx.error(ctx.range(), 'No key here')
            }
            return ctx.callNoFirst(arr, a => {
                const k = new Key(ctx.range(), chars.join(''))
                const kv = new KeyVal(k, a)
                ctx.end()
                finish(kv)
            })
        } else if (c === ',') {
            ctx.flag()
            ctx.error(ctx.range(), 'There should be a value here')
            ctx.end()
            return ReDo
        } else {
            chars.push(c)
        }
    }
}

function val(ctx: Context, finish: (unit: Unit) => void) {
    return (c: char) => {
        if (c === EOF) {
            ctx.flag()
            ctx.error(ctx.range(), 'There should be a value here')
        } else if (reg_Space.test(c)) {
            return
        } else if (c === ',' || c === ':' || c === '=' || c === ']' || c === '}') {
            ctx.flag()
            ctx.error(ctx.range(), 'There should be a value here')
            ctx.end()
            finish(null as any)
            return ReDo
        } else if (reg_Num.test(c)) {
            return ctx.call(num, n => {
                ctx.end()
                finish(n)
            })
        } else if (c === '"' || c === "'") {
            return ctx.callNoFirst(str, c, s => {
                ctx.end()
                finish(s)
            })
        } else if (c === '{') {
            return ctx.callNoFirst(block, b => {
                ctx.end()
                finish(b)
            })
        } else if (c === '[') {
            return ctx.callNoFirst(arr, a => {
                ctx.end()
                finish(a)
            })
        } else {
            return ctx.call(keyword, u => {
                ctx.end()
                finish(u)
            })
        }
    }
}

function num(ctx: Context, finish: (num: Num) => void) {
    const int: string[] = []
    const float: string[] = []
    let dot = false
    ctx.flag()
    return (c: char) => { 
        if (c === EOF) {
            const n = Number(`${int.join('')}.${float.join('')}`)
            finish(new Num(ctx.range(true), n))
        } else if (c === '.') {
            if (dot) {
                ctx.flag()
                ctx.error(ctx.range(), 'Number cannot be dot twice')
            }
            dot = true
        } else if (reg_Num.test(c)) {
            if (dot) float.push(c)
            else int.push(c)
        } else {
            const n = Number(`${int.join('')}.${float.join('')}`)
            ctx.end()
            finish(new Num(ctx.range(true), n))
            return ReDo
        }
    }
}

function str(ctx: Context, first: '"' | "'", finish: (s: Str) => void) {
    const chars: string[] = []
    ctx.flag()
    return (c: char) => { 
        if (c === EOF) {
            ctx.flag()
            ctx.error(ctx.range(), 'String is not closed')
        } else if (c === '"' || c === "'") {
            if (c === first) {
                const s = new Str(ctx.range(), chars.join(''), first)
                ctx.end()
                finish(s)
            } else {
                chars.push(c)
            }
        } else {
            //todo escape
            chars.push(c)
        }
    }
}

function keyword(ctx: Context, finish: (u: Bool | Null) => void) {
    const chars: string[] = []
    ctx.flag()
    return (c: char) => { 
        if (c === EOF) {
            const kw = chars.join('')
            const u = checkkeyword(kw, ctx.range())
            if (u == null) {
                ctx.error(ctx.range(), 'Unknown keyword')
            }
            finish(u!)
        } else if (reg_Space.test(c) || c === '"' || c === "'" || c === ':' || c === '=' || c === ',' || c === '[' || c === '{' || c === ']' || c === '}') {
            const kw = chars.join('')
            const u = checkkeyword(kw, ctx.range())
            if (u == null) {
                ctx.error(ctx.range(), 'Unknown keyword')
            } 
            ctx.end()
            finish(u!)
            return ReDo
        } else {
            chars.push(c)
        }
    }
}

function checkkeyword(kw: string, range: TkRange) {
    return kw === 'true' ? new Bool(range, true) : kw === 'false' ? new Bool(range, false) : kw === 'null' ? new Null : null
}