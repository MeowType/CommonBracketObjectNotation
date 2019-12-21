import { Unit, Block, KeyVal, Arr, Key, Num } from "./ast";
import { isVoid } from "./utils";

const EOF = Symbol('EOF')
type char = string | typeof EOF
const IgnoreFirst = Symbol('IgnoreFirst')
const ReDo = Symbol('ReDo')
type BaseParserUnit = (c: char) => void | typeof ReDo | ParserUnit
type ParserUnit = BaseParserUnit | readonly [BaseParserUnit, typeof IgnoreFirst]

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
            } else if (typeof r === 'function') {
                this.push(r)
                this.call(c)
            } else {
                const [nc, flag] = r
                this.push(nc)
                if (flag !== IgnoreFirst) this.call(c)
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
}

export function parser(code: string) {
    const state = new State
    const ctx = new Context(state)
    let rootAst: Block | Arr
    state.push(root(ctx, (r) => {
        rootAst = r
    }))
    for (const c of code) {
        state.call(c)
    }
    state.call(EOF)
    return rootAst!
}

function root(ctx: Context, finish: (block: Block | Arr) => void) {
    const items: Unit[] = []
    return (c: char) => {
        if (c === EOF) {
            if (items.length == 1) {
                const first = items[0]
                if (first instanceof Block || first instanceof Arr) {
                    return finish(first)
                }
            }
            const first = items[0]
            if (first instanceof KeyVal) {
                const b = new Block(items as KeyVal[])
                return finish(b)
            } else {
                const a = new Arr(items)
                return finish(a)
            }
        } else if (c === '{') {
            return [block(ctx, b => items.push(b)), IgnoreFirst] as const
        } //todo
    }
}

function block(ctx: Context, add: (block: Block) => void) {
    const items: KeyVal[] = []
    return (c: char) => {
        if (c === EOF) {
            
        } else if (reg_Space.test(c) || c === ',') {
            return
        } else if (c === '}') {
            ctx.end()
            add(new Block(items))
            return
        } else if (c === '{' || c === '[' || c === ']' || c === ':' || c === '=') {
            //todo throw
        } else {
            return key(ctx, kv => {
                items.push(kv)
            })
        }
    }
}

function key(ctx: Context, finish: (kv: KeyVal) => void) {
    const chars: string[] = []
    return (c: char) => {
        if (c === EOF) {
            // todo throw
        } else if (reg_Space.test(c) || c === ':' || c === '=') {
            return [val(ctx, v => {
                const k = new Key(chars.join(''))
                const kv = new KeyVal(k, v)
                ctx.end()
                finish(kv)
            }), IgnoreFirst] as const
        } else {
            chars.push(c)
        }
    }
}

function val(ctx: Context, finish: (unit: Unit) => void) {
    const chars: string[] = []
    return (c: char) => {
        if (c === EOF) {
            // todo throw
        } else if (reg_Space.test(c)) {
            return
        } else if (c === ',') {
            if (chars.length === 0) { } // todo throw
        } else if (reg_Num.test(c)) {
            return num(ctx, n => {
                ctx.end()
                finish(n)
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
        }
    }
}