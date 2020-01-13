import { State, Context, ReDo, ParserUnit } from "./state_machine"
import { Tokens, TEOF, TStr, TWord, makeTSymbol, TComments, TBlockComment, TLineComment, TComment } from "./token"
import { Errors } from "./type"
import { TkRange, TkPos } from "./pos"
import { _continue, _break } from "./loop"
import { next_micro_tick } from "./utils"

const EOF = Symbol('EOF')
type char = string | typeof EOF
type Ctx = Context<char>

const reg_Space = /\s/

export function tokenizer(code: string | string[] | Iterable<string> | IterableIterator<string>, show_all_err: boolean, iterable: true, async: true): AsyncGenerator<Tokens, Errors[] | undefined, unknown>
export function tokenizer(code: string | string[] | Iterable<string> | IterableIterator<string>, show_all_err: boolean, iterable: false, async: true): Promise<{ err?: Errors[], val: Tokens[] }>
export function tokenizer(code: string | string[] | Iterable<string> | IterableIterator<string>, show_all_err: boolean, iterable: true, async: false): Generator<Tokens, Errors[] | undefined, unknown>
export function tokenizer(code: string | string[] | Iterable<string> | IterableIterator<string>, show_all_err: boolean, iterable: false, async: false): { err?: Errors[], val: Tokens[] }
export function tokenizer(code: string | string[] | Iterable<string> | IterableIterator<string>, show_all_err: boolean, iterable: boolean, async: boolean): AsyncGenerator<Tokens, Errors[] | undefined, unknown> | Generator<Tokens, Errors[] | undefined, unknown> | Promise<{ err?: Errors[], val: Tokens[] }> | { err?: Errors[], val: Tokens[] }
export function tokenizer(code: string | string[] | Iterable<string> | IterableIterator<string>, show_all_err: boolean = false, iterable: boolean = false, async: boolean): any {
    const state = new State<char>(show_all_err)
    const tokens: Tokens[] = []
    state.push(root(new Context(state), t => {
        tokens.push(t)
    }))
    let last: null | '\r' | '\n' = null
    let finish = false
    const iter = code[Symbol.iterator]()

    function main() {
        if (state.queue.length != 0) {
            state.queue.pop()!()
            return _continue
        }
        let c: char
        if (finish) c = EOF
        else {
            const r = iter.next()
            if (r.done === true) {
                finish = true
                return _continue
            } else c = r.value
        }
        state.call(c)
        if (finish) return _break
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

    const loop = iterable ? async ? async function* () {
        let finish = false
        while (true) {
            await next_micro_tick()
            if (tokens.length !== 0) {
                yield tokens.shift()!
            }
            if (finish) break
            const s = main()
            if (s === _continue) continue
            if (s === _break) {
                finish = true
                continue
            }
        }
        yield new TEOF(new TkRange(state.pos, state.pos))
        if (state.errors.length !== 0) return state.errors
    } : function* () {
        let finish = false
        while (true) {
            if (tokens.length !== 0) {
                yield tokens.shift()!
            }
            if (finish) break
            const s = main()
            if (s === _continue) continue
            if (s === _break) {
                finish = true
                continue
            }
        }
        yield new TEOF(new TkRange(state.pos, state.pos))
        if (state.errors.length !== 0) return state.errors
    } : async ? async function() {
        while (true) {
            await next_micro_tick()
            const s = main()
            if (s === _continue) continue
            if (s === _break) break
        }

        tokens.push(new TEOF(new TkRange(state.pos, state.pos)))

        return state.errors.length !== 0 ? { err: state.errors, val: tokens } : { val: tokens }
    } : function() {
        while (true) {
            const s = main()
            if (s === _continue) continue
            if (s === _break) break
        }

        tokens.push(new TEOF(new TkRange(state.pos, state.pos)))

        return state.errors.length !== 0 ? { err: state.errors, val: tokens } : { val: tokens }
    }

    return loop()
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
        } else if (c === '/' || c === '#') {
            return ctx.callNoFirst(comment, c, push)
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

function word(ctx: Ctx, push: (t: TWord | TComments) => void) {
    const chars: string[] = []
    ctx.flag()
    return (c: char) => { 
        if (c === EOF || reg_Space.test(c) || c === '"' || c === "'" || c === ',' || c === ':' || c === '=' || c === '[' || c === ']' || c === '{' || c === '}') {
            push(new TWord(ctx.range(true), chars.join('')))
            ctx.end()
            return ReDo
        } else if (c === '/' || c === '#') {
            push(new TWord(ctx.range(true), chars.join('')))
            ctx.end()
            return ctx.callNoFirst(comment, c, push)
        } else  {
            chars.push(c)
        }
    }
}

const comment_noerr: (ctx: Ctx, first: '/' | '#', finish: (c: TComments | char) => void, nocc: true) => (c: char) => ParserUnit<char> = comment
function comment(ctx: Ctx, first: '/' | '#', finish: (c: TComments | char) => void, nocc: true): (c: char) => ParserUnit<char>
function comment(ctx: Ctx, first: '/' | '#', finish: (c: TComments) => void, nocc?: false): (c: char) => ParserUnit<char>
function comment(ctx: Ctx, first: '/' | '#', finish: (c: TComments) => void, nocc: boolean = false) {
    ctx.flag()
    const flag = ctx.last_flag!
    return (c: char) => {
        ctx.end()
        if (first === '/') {
            if (c === '/') {
                return ctx.callNoFirst(line_comment, first, flag, finish)
            } else if (c === '*') {
                return ctx.callNoFirst(block_comment, first, flag, finish)
            } else {
                if (nocc) {
                    finish(c as any)
                    return ReDo
                }
                else ctx.error(ctx.range(), 'Line Comment need two /')
                return ctx.call(line_comment, first, flag, finish) 
            }
        } else {
            if (c === '*') {
                return ctx.callNoFirst(block_comment, first, flag, finish)
            } else {
                if (nocc) {
                    finish(c as any)
                    return ReDo
                }
                return ctx.call(line_comment, first, flag, finish)
            }
        }
    }
}

function line_comment(ctx: Ctx, first: '/' | '#', flag: TkPos, finish: (c: TLineComment) => void) {
    const chars: string[] = []
    const items: (string | TComments)[] = []
    ctx.last_flag = flag
    return (c: char) => {
        if (c === EOF || c === '\n' || c === '\r') {
            if (chars.length > 0) items.push(chars.join(''))
            ctx.end()
            finish(new TLineComment(ctx.range(), items))
            return ReDo
        } else if (c === '/' || c === '#') {
            if (chars.length > 0) items.push(chars.join(''))
            chars.length = 0
            return ctx.callNoFirst(comment, c, cm => {
                items.push(cm)
            })
        } else {
            chars.push(c)
        }
    }
}

function block_comment(ctx: Ctx, first: '/' | '#', flag: TkPos, finish: (c: TBlockComment) => void) {
    const chars: string[] = []
    const items: (string | TComments)[] = []
    let star = false
    ctx.last_flag = flag
    let redo_end = false
    return (c: char) => {
        if (redo_end) {
            ctx.end()
            return ReDo
        }
        if (c === EOF) {
            if (star) chars.push('*')
            if (chars.length > 0) items.push(chars.join(''))
            ctx.end()
            finish(new TBlockComment(ctx.range(), items))
            ctx.flag()
            ctx.error(ctx.range(), 'Block Comment is not close')
            return ReDo
        } else if (c === '*') {
            if (star) chars.push('*')
            else star = true
        } else if (c === '/' || c === '#') {
            if (star) {
                star = false
                if (c === first) {
                    return ctx.callNoFirst(comment_noerr, c, w => {
                        if (w instanceof TLineComment || w instanceof TBlockComment) {
                            if (chars.length > 0) items.push(chars.join(''))
                            chars.length = 0
                            items.push(w)
                        } else {
                            if (chars.length > 0) items.push(chars.join(''))
                            chars.length = 0
                            redo_end = true
                            finish(new TBlockComment(ctx.range(), items))
                        }
                    }, true)
                } else {
                    chars.push('*')
                    chars.push(c)
                }
            } else {
                return ctx.callNoFirst(comment_noerr, c, w => {
                    if (w === EOF) {
                        chars.push(c)
                    } else if (w instanceof TLineComment || w instanceof TBlockComment) {
                        if (chars.length > 0) items.push(chars.join(''))
                        chars.length = 0
                        items.push(w)
                    } else {
                        chars.push(c)
                        chars.push(w)
                    }
                }, true)
            }
        } else {
            if (star) chars.push('*')
            star = false
            chars.push(c)
        }
    }
}