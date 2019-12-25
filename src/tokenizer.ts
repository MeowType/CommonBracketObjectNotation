import { State, Context, ReDo, WhenError } from "./state_machine"
import { Tokens, TEOF, TStr, TSymbol, TNum, TWord } from "./token"
import { Errors } from "./type"

const EOF = Symbol('EOF')
type char = string | typeof EOF
type Ctx = Context<char>

const reg_Space = /\s/
const reg_Num = /(\d|_)/

export function tokenizer(code: string, show_all_err: boolean = false): {
    type: 'errors'
    val: Errors[]
} | {
    type: 'tokens'
    val: Tokens[]
} {
    const state = new State<char>(show_all_err)
    const tokens: Tokens[] = []
    state.push(root(new Context(state), t => {
        tokens.push(t)
    }))
    let last: null | '\r' | '\n' = null
    for (const c of code) {
        try {
            state.call(c)
        } catch (e) {
            if (e instanceof WhenError) {
                return {
                    type: 'errors',
                    val: [e.err]
                }
            } else throw e
        }
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
    try {
        state.call(EOF)
    } catch (e) {
        if (e instanceof WhenError) {
            return {
                type: 'errors',
                val: [e.err]
            }
        } else throw e
    }
    if (state.errors.length !== 0) {
        return {
            type: 'errors',
            val: state.errors
        }
    }
    tokens.push(new TEOF)
    return {
        type: 'tokens',
        val: tokens
    }
}

function root(ctx: Ctx, push: (t: Tokens) => void) {
    return (c: char) => {
        if (c === EOF) {
            ctx.end() 
        } else if (reg_Space.test(c)) {
            return
        } else if (reg_Num.test(c)) {
            return ctx.call(num, push)
        } else if (c === ',' || c === ':' || c === '=' || c === '[' || c === ']' || c === '{' || c === '}') {
            ctx.flag()
            push(new TSymbol(ctx.range(), c))
        } else if (c === '"' || c === "'") {
            return ctx.callNoFirst(str, c, push)
        } else {
            return ctx.call(word, push)
        }
    }
}

function str(ctx: Ctx, first: '"' | "'", push: (t: TStr) => void) {
    const chars: string[] = []
    ctx.flag()
    return (c: char) => {
        if (c === EOF) {
            ctx.error(ctx.range(), 'String is not closed')
            ctx.end()
            return ReDo
        } else if (c === '"' || c === "'") {
            if (c === first) { 
                const s = new TStr(ctx.range(), chars.join(''), first)
                ctx.end()
                push(s)
            } else {
                chars.push(c)
            }
        } else {
            //todo escape
            chars.push(c)
        }
    }
}

function num(ctx: Ctx, push: (t: TNum) => void) {
    const int: string[] = []
    const float: string[] = []
    let dot = false
    ctx.flag()
    return (c: char) => {
        if (c === EOF || reg_Space.test(c)) {
            const n = Number(`${int.join('')}.${float.join('')}`)
            ctx.end()
            push(new TNum(ctx.range(true), n))
            return ReDo
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
            push(new TNum(ctx.range(true), n))
            return ReDo
        }
    }
}

function word(ctx: Ctx, push: (t: TWord) => void) {
    const chars: string[] = []
    ctx.flag()
    return (c: char) => { 
        if (c === EOF || reg_Space.test(c) || c === '"' || c === "'" || c === ',' || c === ':' || c === '=' || c === '[' || c === ']' || c === '{' || c === '}') {
            push(new TWord(ctx.range(true), chars.join('')))
            ctx.end()
            return ReDo
        } else {
            chars.push(c)
        }
    }
}