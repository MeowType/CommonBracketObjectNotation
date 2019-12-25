import { State, Context, ReDo, WhenError } from "./state_machine"
import { Tokens, TEOF, TStr, TWord, makeTSymbol } from "./token"
import { Errors } from "./type"
import { TkRange } from "./pos"

const EOF = Symbol('EOF')
type char = string | typeof EOF
type Ctx = Context<char>

const reg_Space = /\s/

export function tokenizer(code: string, show_all_err: boolean = false): {
    err?: Errors[],
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
                    err: [e.err],
                    val: tokens
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
                err: [e.err],
                val: tokens
            }
        } else throw e
    }
    if (state.errors.length !== 0) {
        return {
            err: state.errors,
            val: tokens
        }
    }
    tokens.push(new TEOF(new TkRange(state.pos, state.pos)))
    return {
        val: tokens
    }
}

function root(ctx: Ctx, push: (t: Tokens) => void) {
    return (c: char) => {
        if (c === EOF) {
            ctx.end() 
        } else if (reg_Space.test(c)) {
            return
        } else if (c === ',' || c === ':' || c === '=' || c === '[' || c === ']' || c === '{' || c === '}') {
            ctx.flag()
            push(makeTSymbol(ctx.range(), c))
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