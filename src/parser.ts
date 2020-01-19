import { Block, KeyVal, Arr, Key, Num, Str, Bool, Null, Docs, Comma, Split, LineComment, BlockComment, Units, Comments } from "./ast";
import { State, Context, WhenError, ReDo } from "./state_machine";
import { Tokens, TEOF, TStr, TWord, TSObjStart, TSArrStart, TSComma, TSObjEnd, TSArrEnd, TSSplit, TLineComment, TBlockComment } from "./token";
import { Errors } from "./type";
import { getIterator, next_micro_tick } from "./utils";
import { _continue, _break } from "./loop";
import { Canceller, AsyncCanceller, AlwaysFalse } from "./canceller";

type Ctx = Context<Tokens>

export type token_list = Tokens[] | Iterable<Tokens> | Generator<Tokens, Errors[] | undefined>
export type async_token_list = token_list | AsyncIterable<Tokens> | AsyncGenerator<Tokens, Errors[] | undefined>
export function parser(code: async_token_list, config: { show_all_err?: boolean, async: true, cancel?: Canceller | AsyncCanceller }): Promise<{ err?: Errors[], val: Docs }>
export function parser(code: token_list, config: { show_all_err?: boolean, async: false, cancel?: Canceller }): { err?: Errors[], val: Docs }
export function parser(code: token_list, config?: { show_all_err?: boolean, cancel?: Canceller }): { err?: Errors[], val: Docs }
export function parser(code: async_token_list, config?: { show_all_err?: boolean, async?: boolean, cancel?: Canceller | AsyncCanceller }): Promise<{ err?: Errors[], val: Docs }> | { err?: Errors[], val: Docs }
export function parser(code: async_token_list,
    config: { show_all_err?: boolean, async?: boolean, cancel?: Canceller | AsyncCanceller }
    = { show_all_err: false, async: false, cancel: AlwaysFalse }
): any {
    const cancel = config?.cancel ?? AlwaysFalse
    const state = new State<Tokens>(config?.show_all_err ?? false)
    let rootAst: Docs
    state.push(root(new Context(state), (d) => {
        rootAst = d
    }))

    let finish = false
    const iter = getIterator(code)

    function* main() {
        if (state.queue.length != 0) {
            state.queue.pop()!()
            return _continue
        }
        if (finish) return _break
        const c: IteratorResult<Tokens> = yield iter.next()
        if (c.done === true) {
            finish = true
            return _continue
        }
        state.call(c.value)
    }

    const loop = config?.async ?? false ? async function () {
        while (true) {
            if (await cancel()) break
            const g = main()
            let y = g.next()
            if (!y.done) {
                y = g.next(await y.value)
            } 
            const s = y.value
            if (s === _continue) {
                await next_micro_tick()
                continue
            }
            if (s === _break) break
            await next_micro_tick()
        }
        return state.errors.length !== 0 ? { err: state.errors, val: rootAst! } : { err: state.errors, val: rootAst! }
    } : function () {
        while (true) {
            if (cancel()) break
            const g = main()
            let y = g.next()
            if (!y.done) {
                y = g.next(y.value as any)
            }
            const s = y.value
            if (s === _continue) continue
            if (s === _break) break
        }
        return state.errors.length !== 0 ? { err: state.errors, val: rootAst! } : { err: state.errors, val: rootAst! }
    }

    return loop()
}

function root(ctx: Ctx, finish: (docs: Docs) => void) {
    const items: (Block | Arr | Comments)[] = []
    return (t: Tokens) => {
        if (t instanceof TEOF) {
            finish(new Docs(items))
        } else if (t instanceof TSObjStart) {
            return ctx.callNoFirst(block, t, b => items.push(b))
        } else if (t instanceof TSArrStart) {
            return ctx.callNoFirst(arr, t, a => items.push(a))
        } else if (t instanceof TLineComment) {
            items.push(new LineComment(t.range, t.items))
        } else if (t instanceof TBlockComment) {
            items.push(new BlockComment(t.range, t.items))
        } else {
            ctx.error(t.range, 'File root must have no content other than a document')
        }
    }
}

function block(ctx: Ctx, begin: TSObjStart, finish: (block: Block) => void) {
    const items: (KeyVal | Comma)[] = []
    return (t: Tokens) => { 
        if (t instanceof TEOF) {
            ctx.error(t.range, 'Block is not closed')
            ctx.end()
            finish(new Block(begin.range, t.range, items))
            return ReDo
        } else if (t instanceof TSComma) {
            items.push(new Comma(t.range))
        } else if (t instanceof TSObjEnd) {
            ctx.end()
            finish(new Block(begin.range, t.range, items))
        } else if (t instanceof TSObjStart) {
            ctx.error(t.range, 'Block content must start with a key')
            return ctx.callNoFirst(block, t, _ => {})
        } else if (t instanceof TSArrStart) {
            ctx.error(t.range, 'Block content must start with a key')
            return ctx.callNoFirst(arr, t, _ => { })
        } else if (t instanceof TStr || t instanceof TWord ) {
            return ctx.callNoFirst(key, t, kv => items.push(kv))
        } else if (t instanceof TSArrEnd) {
            ctx.error(t.range, 'No Array here')
        } else {
            ctx.error(t.range, 'Block content must start with a key')
        }
    }
}

function arr(ctx: Ctx, begin: TSArrStart, finish: (arr: Arr) => void) {
    const items: Units[] = []
    return (t: Tokens) => {
        if (t instanceof TEOF) {
            ctx.error(t.range, 'Array is not closed')
            ctx.end()
            finish(new Arr(begin.range, t.range, items))
            return ReDo
        } else if (t instanceof TSComma) {
            items.push(new Comma(t.range))
        } else if (t instanceof TSArrEnd) {
            ctx.end()
            finish(new Arr(begin.range, t.range, items))
        } else if (t instanceof TSObjEnd) {
            ctx.error(t.range, 'No Block here')
        } else if (t instanceof TSSplit) {
            ctx.error(t.range, 'Array cant have key')
        } else {
            return ctx.call(val, u => items.push(u))
        }
    }
}

function key(ctx: Ctx, k: TStr | TWord, finish: (kv: KeyVal) => void) {
    return (t: Tokens) => {
        if (t instanceof TEOF) {
            ctx.error(t.range, 'There should be a key value here')
            ctx.end()
            return ReDo
        } else if (t instanceof TSComma) {
            ctx.error(t.range, 'There should be a key value here')
            ctx.end()
            return ReDo
        } else if (t instanceof TSSplit) {
            ctx.end()
            return ctx.callNoFirst(val, u => {
                const sp = new Split(t.range, t.val as any)
                const kv = new KeyVal(new Key(k.range, k instanceof TStr ? new Str(k.range, k.val, k.col) : k.val), u, sp)
                finish(kv)
            })
        } else {
            ctx.end()
            return ctx.call(val, u => {
                const kv = new KeyVal(new Key(k.range, k instanceof TStr ? new Str(k.range, k.val, k.col) : k.val), u)
                finish(kv)
            })
        }
    }
}

function val(ctx: Ctx, finish: (u: Units) => void) {
    return (t: Tokens) => { 
        if (t instanceof TEOF) {
            ctx.error(t.range, 'There should be a value here')
            ctx.end()
            return ReDo
        } else if (t instanceof TStr) {
            ctx.end()
            finish(new Str(t.range, t.val, t.col))
        } else if (t instanceof TWord) {
            ctx.end()
            return ctx.call(word, t, u => {
                finish(u)
            })
        } else if (t instanceof TSComma || t instanceof TSSplit || t instanceof TSArrEnd || t instanceof TSObjEnd) {
            ctx.error(t.range, 'There should be a value here')
            ctx.end()
            return ReDo
        } else if (t instanceof TSObjStart) {
            ctx.end()
            return ctx.callNoFirst(block, t, b => {
                finish(b)
            })
        } else if (t instanceof TSArrStart) {
            ctx.end()
            return ctx.callNoFirst(arr, t, a => {
                finish(a)
            })
        } else {
            t
            //todo
            ctx.end()
        }
    }
}

const reg_Num = /(0x[\da-fA-F_]+)|(([\-]?([\d\_])+)\.([\-]?([\d\_])+([eE]([\-]?)\d+)?))|(([\-]?([\d\_])+)\.([eE]([\-]?)\d+)?)|([\-]?\.(([\d\_])+([eE]([\-]?)\d+)?))|(([\-]?([\d\_])+([eE]([\-]?)\d+)?))/i

function word(ctx: Ctx, w: TWord, finish: (u: Bool | Num | Str | Null) => void) {
    return (t: Tokens) => { 
        ctx.end()
        if (w.val === 'true') {
            finish(new Bool(w.range, true))
        } else if (w.val === 'false') {
            finish(new Bool(w.range, false))
        } else if (w.val === 'null') {
            finish(new Null(w.range))
        } else if (reg_Num.test(w.val)) {
            finish(new Num(w.range, Number(w.val.replace('_', ''))))
        } else {
            finish(new Str(w.range, w.val, null))
        }
    }
}