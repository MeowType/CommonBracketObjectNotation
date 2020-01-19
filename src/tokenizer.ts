import { State, Context, ReDo, ParserUnit } from "./state_machine"
import { Tokens, TEOF, TStr, TWord, makeTSymbol, TComments, TBlockComment, TLineComment, TComment } from "./token"
import { Errors } from "./type"
import { TkRange, TkPos } from "./pos"
import { _continue, _break } from "./loop"
import { next_micro_tick } from "./utils"
import { Canceller, AlwaysFalse, AsyncCanceller } from "./canceller"

const EOF = Symbol('EOF')
type char = string | typeof EOF
type Ctx = Context<char>

const reg_Space = /\s/

export type char_list = string | string[] | Iterable<string>
export function tokenizer(code: char_list, config: { show_all_err?: boolean, iterable: true, async: true, cancel?: Canceller | AsyncCanceller }): AsyncGenerator<Tokens, Errors[] | undefined, unknown>
export function tokenizer(code: char_list, config: { show_all_err?: boolean, iterable: false, async: true, cancel?: Canceller | AsyncCanceller }): Promise<{ err?: Errors[], val: Tokens[] }>
export function tokenizer(code: char_list, config: { show_all_err?: boolean, iterable: true, async: false, cancel?: Canceller }): Generator<Tokens, Errors[] | undefined, unknown>
export function tokenizer(code: char_list, config: { show_all_err?: boolean, iterable: false, async: false, cancel?: Canceller }): { err?: Errors[], val: Tokens[] }
export function tokenizer(code: char_list, config?: { show_all_err?: boolean, cancel?: Canceller }): { err?: Errors[], val: Tokens[] }
export function tokenizer(code: char_list, config?: { show_all_err?: boolean, iterable?: boolean, async?: boolean, cancel?: Canceller | AsyncCanceller }): AsyncGenerator<Tokens, Errors[] | undefined, unknown> | Generator<Tokens, Errors[] | undefined, unknown> | Promise<{ err?: Errors[], val: Tokens[] }> | { err?: Errors[], val: Tokens[] }
export function tokenizer(code: char_list,
    config: { show_all_err?: boolean, iterable?: boolean, async?: boolean, cancel?: Canceller | AsyncCanceller }
    = { show_all_err: false, iterable: false, async: false, cancel: AlwaysFalse }
): any {
    const cancel = config?.cancel ?? AlwaysFalse
    const state = new State<char>(config?.show_all_err ?? false)
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

    const loop = config?.iterable ?? false ? config?.async ?? false ? async function* () {
        let finish = false
        while (true) {
            if (await cancel()) break
            if (tokens.length !== 0) {
                yield tokens.shift()!
            }
            if (finish) break
            const s = main()
            if (s === _continue) {
                await next_micro_tick()
                continue
            }
            if (s === _break) {
                finish = true
                await next_micro_tick()
                continue
            }
            await next_micro_tick()
        }
        yield new TEOF(new TkRange(state.pos, state.pos))
        if (state.errors.length !== 0) return state.errors
    } : function* () {
        let finish = false
        while (true) {
            if (cancel()) break
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
    } : config?.async?? false ? async function() {
            while (true) {
            if (await cancel()) break
            const s = main()
            if (s === _continue) {
                await next_micro_tick()
                continue
            }
            if (s === _break) break
            await next_micro_tick()
        }

        tokens.push(new TEOF(new TkRange(state.pos, state.pos)))

        return state.errors.length !== 0 ? { err: state.errors, val: tokens } : { val: tokens }
    } : function() {
        while (true) {
            if (cancel()) break
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
        } else if (c === '\\') {
            return ctx.callNoFirst(escape, c => chars.push(c))
        } else {
            chars.push(c)
        }
    }
}

const hex_digits = /[0-9a-fA-F]/i
function escape(ctx: Ctx, push: (c: string) => void) {
    let onUnicode = false
    let chars: string[] = []
    let block = false
    ctx.flag()
    return (c: char) => {
        if (onUnicode) {
            if (c === EOF) {
                ctx.error(ctx.range(), 'Unicode escape is not finish')
                ctx.end()
                return ReDo
            } else if (hex_digits.test(c)) {
                chars.push(c)
                if (!block && chars.length === 4) {
                    ctx.end()
                    push(String.fromCodePoint(Number(`0x${chars.join('')}`)))
                }
            } else if (c === '{') {
                if (chars.length !== 0 || block) {
                    ctx.error(ctx.range(), 'Unicode escape is not finish')
                    ctx.end()
                    return ReDo
                }
                block = true
            } else if (c === '}') {
                ctx.end()
                if (!block) {
                    ctx.error(ctx.range(), 'Not in Unicode escape block')
                    return
                } else if (chars.length === 0 || chars.length > 6) {
                    ctx.error(ctx.range(), 'Invalid Unicode escape sequence')
                    return
                }
                push(String.fromCodePoint(Number(`0x${chars.join('')}`)))
            } else {
                ctx.error(ctx.range(), 'Unicode escape is not finish')
                ctx.end()
                return ReDo
            }
        } else {
            if (c === 'u') {
                onUnicode = true
            } else {
                ctx.end()
                if (c === EOF) {
                    return ReDo
                } else {
                    push(c === 'n' ? '\n' : c === 'r' ? '\r' : c === 't' ? '\t' : c === '\\' ? '\\' : c === '"' ? '"' : c === "'" ? "'" : c === '0' ? '\0' : c === 'b' ? '\b' : c === 'f' ? '\f' : c === 'v' ? '\v' : c)
                }
            }
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