import { Unit, Block, KeyVal, Arr, Key, Num, Str, Bool, Null, Docs } from "./ast";
import { isVoid } from "./utils";

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
    states: BaseParserUnit[] = []
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
}

class Context {
    state: State
    constructor(state: State) {
        this.state = state
    }
    end() {
        this.state.pop()
    }
    call<F extends ParserUnitFn>(f: F, ...p: TailParams<F>): ParserUnit {
        return {
            fn: f(this, ...p),
            ignoreFirst: false
        }
    }
    callNoFirst<F extends ParserUnitFn>(f: F, ...p: TailParams<F>): ParserUnit {
        return {
            fn: f(this, ...p),
            ignoreFirst: true
        }
    }
}

export function parser(code: string) {
    const state = new State
    const ctx = new Context(state)
    let rootAst: Docs
    state.push(root(ctx, (d) => {
        rootAst = d
    }))
    for (const c of code) {
        state.call(c)
    }
    state.call(EOF)
    return rootAst!
}

function root(ctx: Context, finish: (docs: Docs) => void) {
    const items: (Block | Arr)[] = []
    return (c: char) => {
        if (c === EOF) {
            finish(new Docs(items))
        } else if (c === '{') {
            return ctx.callNoFirst(block, b => items.push(b as any))
        } else if (c === '[') {
            return ctx.callNoFirst(arr, a => items.push(a as any))
        } else {
            // todo throw
        }
    }
}


function block(ctx: Context, finish: (block: Block) => void) {
    const items: KeyVal[] = []
    return (c: char) => {
        if (c === EOF) {
            //todo throw
        } else if (reg_Space.test(c) || c === ',') {
            return
        } else if (c === '}') {
            ctx.end()
            finish(new Block(items))
            return
        } else if (c === '{' || c === '[' || c === ']' || c === ':' || c === '=') {
            //todo throw
        } else {
            return ctx.call(key, kv => {
                items.push(kv)
            })
        }
    }
}

function arr(ctx: Context, finish: (block: Arr) => void) {
    const items: Unit[] = []
    return (c: char) => { 
        if (c === EOF || c === ':' || c === '=') {
            //todo throw
        } else if (reg_Space.test(c) || c === ',') {
            return
        } else if (c === ']') {
            ctx.end()
            finish(new Arr(items))
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
    return (c: char) => {
        if (c === EOF) {
            // todo throw
        } else if (s != null) {
            return ctx.call(val, v => {
                const k = new Key(s!)
                const kv = new KeyVal(k, v)
                ctx.end()
                finish(kv)
            })
        } else if (c === '"' || c === "'") {
            if (chars.length !== 0 || s != null) {
                return ctx.callNoFirst(str, c, s => {
                    const k = new Key(chars.join(''))
                    const kv = new KeyVal(k, s)
                    ctx.end()
                    finish(kv)
                })
            }
            return ctx.callNoFirst(str, c, s => {
                s = s
            })
        } else if (reg_Space.test(c) || c === ':' || c === '=') {
            return ctx.callNoFirst(val, v => {
                const k = new Key(chars.join(''))
                const kv = new KeyVal(k, v)
                ctx.end()
                finish(kv)
            })
        } else if (c === '{') {
            return ctx.callNoFirst(block, b => {
                const k = new Key(chars.join(''))
                const kv = new KeyVal(k, b)
                ctx.end()
                finish(kv)
            })
        } else if (c === '[') {
            return ctx.callNoFirst(arr, a => {
                const k = new Key(chars.join(''))
                const kv = new KeyVal(k, a)
                ctx.end()
                finish(kv)
            })
        } else {
            chars.push(c)
        }
    }
}

function val(ctx: Context, finish: (unit: Unit) => void) {
    return (c: char) => {
        if (c === EOF) {
            // todo throw
        } else if (reg_Space.test(c)) {
            return
        } else if (c === ',' || c === ':' || c === '=' || c === ',' || c === ']' || c === '}') {
            //todo throw
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
    return (c: char) => { 
        if (c === EOF) {
            // todo throw
        } else if (c === '.') {
            if(dot) {} //todo throw
            dot = true
        } else if (reg_Num.test(c)) {
            if (dot) float.push(c)
            else int.push(c)
        } else {
            const n = Number(`${int.join('')}.${float.join('')}`)
            ctx.end()
            finish(new Num(n))
            return ReDo
        }
    }
}

function str(ctx: Context, first: '"' | "'", finish: (s: Str) => void) {
    const chars: string[] = []
    return (c: char) => { 
        if (c === EOF) {
            // todo throw
        } else if (c === '"' || c === "'") {
            if (c === first) {
                const s = new Str(chars.join(''), first)
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
    return (c: char) => { 
        if (c === EOF || reg_Space.test(c) || c === '"' || c === "'" || c === ':' || c === '=' || c === ',' || c === '[' || c === '{' || c === ']' || c === '}') {
            const kw = chars.join('')
            const u = checkkeyword(kw)
            if (u == null) { return } //todo throw
            ctx.end()
            finish(u)
            return ReDo
        } else {
            chars.push(c)
        }
    }
}

function checkkeyword(kw: string) {
    return kw === 'true' ? new Bool(true) : kw === 'false' ? new Bool(false) : kw === 'null' ? new Null : null
}