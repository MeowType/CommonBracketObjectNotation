import { Unit, Block, KeyVal, Arr, Key, Num, Str, Bool, Null, Docs, Comma, Split } from "./ast";
import { TkRange } from "./pos";
import { State, Context, WhenError, ReDo } from "./state_machine";
import { Tokens, TEOF, TSymbol, TStr, TWord } from "./token";

type Ctx = Context<Tokens>

export function parser(code: Tokens[], show_all_err: boolean = false) {
    const state = new State<Tokens>(show_all_err)
    let rootAst: Docs
    state.push(root(new Context(state), (d) => {
        rootAst = d
    }))
    for (const c of code) {
        try {
            state.call(c)
        } catch (e) {
            if (e instanceof WhenError) {
                return [e.err]
            } else throw e
        }
    }
    if (state.errors.length !== 0) {
        return state.errors
    }
    return rootAst!
}

function root(ctx: Ctx, finish: (docs: Docs) => void) {
    const items: (Block | Arr)[] = []
    return (t: Tokens) => {
        if (t instanceof TEOF) {
            finish(new Docs(items))
        } else if (t instanceof TSymbol && t.val === '{') {
            return ctx.callNoFirst(block, t, b => items.push(b))
        } else if (t instanceof TSymbol && t.val === '[') {
            return ctx.callNoFirst(arr, t, a => items.push(a))
        } else {
            ctx.error(t.range, 'File root must have no content other than a document')
        }
    }
}

function block(ctx: Ctx, begin: TSymbol, finish: (block: Block) => void) {
    const items: (KeyVal | Comma)[] = []
    return (t: Tokens) => { 
        if (t instanceof TEOF) {
            ctx.error(t.range, 'Block is not closed')
            ctx.end()
            finish(new Block(begin.range, t.range, items))
            return ReDo
        } else if (t instanceof TSymbol && t.val === ',') {
            items.push(new Comma(t.range))
        } else if (t instanceof TSymbol && t.val === '}') {
            ctx.end()
            finish(new Block(begin.range, t.range, items))
        } else if (t instanceof TSymbol && t.val === '{') {
            ctx.error(t.range, 'Block content must start with a key')
            return ctx.callNoFirst(block, t, _ => {})
        } else if (t instanceof TStr || t instanceof TWord ) {
            return ctx.callNoFirst(key, t, kv => items.push(kv))
        } else if (t instanceof TSymbol && t.val === ']') {
            ctx.error(t.range, 'Block is not closed')
            ctx.end()
            finish(new Block(begin.range, t.range, items))
            return ReDo
        } else {
            ctx.error(t.range, 'Block content must start with a key')
        }
    }
}

function arr(ctx: Ctx, begin: TSymbol, finish: (arr: Arr) => void) {
    const items: Unit[] = []
    return (t: Tokens) => {
        if (t instanceof TEOF) {
            ctx.error(t.range, 'Array is not closed')
            ctx.end()
            finish(new Arr(begin.range, t.range, items))
            return ReDo
        } else if (t instanceof TSymbol && t.val === ',') {
            items.push(new Comma(t.range))
        } else if (t instanceof TSymbol && t.val === ']') {
            ctx.end()
            finish(new Arr(begin.range, t.range, items))
        } else if (t instanceof TSymbol && t.val === '}') {
            ctx.error(t.range, 'Array is not closed')
            ctx.end()
            finish(new Arr(begin.range, t.range, items))
            return ReDo
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
        } else if (t instanceof TSymbol && t.val === ',') {
            ctx.error(t.range, 'There should be a key value here')
            ctx.end()
            return ReDo
        } else if (t instanceof TSymbol && (t.val === ':' || t.val === '=')) {
            return ctx.callNoFirst(val, u => {
                const sp = new Split(t.range, t.val as any)
                const kv = new KeyVal(new Key(k.range, k instanceof TStr ? new Str(k.range, k.val, k.col) : k.val), u, sp)
                ctx.end()
                finish(kv)
            })
        } else {
            return ctx.call(val, u => {
                const kv = new KeyVal(new Key(k.range, k instanceof TStr ? new Str(k.range, k.val, k.col) : k.val), u)
                ctx.end()
                finish(kv)
            })
        }
    }
}

function val(ctx: Ctx, finish: (u: Unit) => void) {
    return (t: Tokens) => { 
        if (t instanceof TEOF) {
            ctx.error(t.range, 'There should be a key value here')
            ctx.end()
            return ReDo
        } else if (t instanceof TStr) {
            ctx.end()
            finish(new Str(t.range, t.val, t.col))
        } else if (t instanceof TWord) {
            return ctx.call(word, t, u => {
                ctx.end()
                finish(u)
            })
        } else if (t instanceof TSymbol && (t.val === ',' || t.val === ':' || t.val === '=' || t.val === ']' || t.val === '}' )) {
            ctx.error(t.range, 'There should be a key value here')
            ctx.end()
            return ReDo
        } else if (t instanceof TSymbol && t.val === '{') {
            return ctx.callNoFirst(block, t, b => {
                ctx.end()
                finish(b)
            })
        } else if (t instanceof TSymbol && t.val === '[') {
            return ctx.callNoFirst(arr, t, a => {
                ctx.end()
                finish(a)
            })
        } else {
            t
            //todo
            ctx.end()
        }
    }
}

const reg_Num = /(0x[\da-fA-F_]+)|(([\-]?([\d\_])+)\.([\-]?([\d\_])+([eE]([\-]?)\d+)?))|(([\-]?([\d\_])+)\.([eE]([\-]?)\d+)?)|([\-]?\.(([\d\_])+([eE]([\-]?)\d+)?))|(([\-]?([\d\_])+([eE]([\-]?)\d+)?))/gi

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

// function root(ctx: Ctx, finish: (docs: Docs) => void) {
//     const items: (Block | Arr)[] = []
//     let errchar: boolean = false
//     return (c: char) => {
//         if (c === EOF) {
//             if (errchar) {
//                 ctx.error(ctx.range(true), 'File root must have no content other than a document')
//                 errchar = false
//             }
//             finish(new Docs(items))
//         } else if (c === '{') {
//             if (errchar) {
//                 ctx.error(ctx.range(true), 'File root must have no content other than a document')
//                 errchar = false
//             }
//             return ctx.callNoFirst(block, b => items.push(b as any))
//         } else if (c === '[') {
//             if (errchar) {
//                 ctx.error(ctx.range(true), 'File root must have no content other than a document')
//                 errchar = false
//             }
//             return ctx.callNoFirst(arr, a => items.push(a as any))
//         } else {
//             if (!errchar) {
//                 ctx.flag()
//             }
//             errchar = true
//         }
//     }
// }

// function line_comment() {

// }

// function block(ctx: Ctx, finish: (block: Block) => void) {
//     const items: (KeyVal | Comma)[] = []
//     ctx.flag()
//     const begin = ctx.range()
//     return (c: char) => {
//         if (c === EOF) {
//             ctx.flag()
//             ctx.error(ctx.range(), 'Block is not closed')
//             ctx.end()
//             return ReDo
//         } else if (reg_Space.test(c) || c === ',') {
//             ctx.flag()
//             items.push(new Comma(ctx.range()))
//             return
//         } else if (c === '}') {
//             ctx.flag()
//             const end = ctx.range()
//             ctx.end()
//             finish(new Block(begin, end, items))
//             return
//         } else if (c === ':' || c === '=') {
//             ctx.flag()
//             ctx.error(ctx.range(), 'Block content must start with a key')
//         } else if (c === '[') {
//             ctx.flag()
//             ctx.error(ctx.range(), 'Block content must start with a key')
//             return ctx.callNoFirst(arr, _ => { })
//         } else if (c === '{' ) {
//             ctx.flag()
//             ctx.error(ctx.range(), 'Block content must start with a key')
//             return ctx.callNoFirst(block, _ => { })
//         } else if (c === ']') {
//             ctx.flag()
//             ctx.error(ctx.range(), 'Block is not closed')
//             ctx.end()
//             return ReDo
//         } else {
//             return ctx.call(key, kv => {
//                 items.push(kv)
//             })
//         }
//     }
// }

// function arr(ctx: Ctx, finish: (block: Arr) => void) {
//     const items: Unit[] = []
//     ctx.flag()
//     const begin = ctx.range()
//     return (c: char) => { 
//         if (c === EOF) {
//             ctx.flag()
//             ctx.error(ctx.range(), 'Array is not closed')
//             ctx.end()
//             return ReDo
//         } else if (c === ':' || c === '=') {
//             ctx.flag()
//             ctx.error(ctx.range(), 'Array cant have key')
//         } else if (reg_Space.test(c) || c === ',') {
//             ctx.flag()
//             items.push(new Comma(ctx.range()))
//             return
//         } else if (c === ']') {
//             ctx.flag()
//             const end = ctx.range()
//             ctx.end()
//             finish(new Arr(begin, end, items))
//             return
//         } else if (c === '{') {
//             return ctx.callNoFirst(block, b => items.push(b))
//         } else if (c === '[') {
//             return ctx.callNoFirst(arr, a => items.push(a))
//         } else {
//             return ctx.call(val, u => {
//                 items.push(u)
//             })
//         }
//     }
// }

// function key(ctx: Ctx, finish: (kv: KeyVal) => void) {
//     const chars: string[] = []
//     let charsEnd = false
//     let charsRange: TkRange | null = null
//     let s: Str | null = null
//     ctx.flag()
//     return (c: char) => {
//         if (c === EOF) {
//             ctx.flag()
//             ctx.error(ctx.range(), 'There should be a key value here')
//             ctx.end()
//             return ReDo
//         } else if (s != null) {
//             return ctx.call(val, v => {
//                 const k = new Key(ctx.range(), s!)
//                 const kv = new KeyVal(k, v)
//                 ctx.end()
//                 finish(kv)
//             })
//         } else if (c === '"' || c === "'") {
//             if (chars.length !== 0 || s != null) {
//                 return ctx.callNoFirst(str, c, s => {
//                     const k = new Key(ctx.range(), chars.join(''))
//                     const kv = new KeyVal(k, s)
//                     ctx.end()
//                     finish(kv)
//                 })
//             }
//             return ctx.callNoFirst(str, c, s => {
//                 s = s
//             })
//         } else if (reg_Space.test(c)) {
//             if (chars.length === 0) {
//                 ctx.error(ctx.range(), 'No key here')
//             }
//             if (!charsEnd) {
//                 charsEnd = true
//                 charsRange = ctx.range(true)
//             }
//             return
//         } else if (c === ':' || c === '=') {
//             if (charsEnd) { 
//                 ctx.flag()
//                 const sp = new Split(ctx.range(), c)
//                 return ctx.callNoFirst(val, v => {
//                     const k = new Key(charsRange!, chars.join(''))
//                     const kv = new KeyVal(k, v, sp)
//                     ctx.end()
//                     finish(kv)
//                 })
//             }
//             if (chars.length === 0) {
//                 ctx.error(ctx.range(), 'No key here')
//             }
//             const key_range = ctx.range(true)
//             ctx.flag()
//             const sp = new Split(ctx.range(), c)
//             return ctx.callNoFirst(val, v => {
//                 const k = new Key(key_range, chars.join(''))
//                 const kv = new KeyVal(k, v, sp)
//                 ctx.end()
//                 finish(kv)
//             })
//         } else if (c === '{') {
//             if (charsEnd) {
//                 return ctx.callNoFirst(block, b => {
//                     const k = new Key(charsRange!, chars.join(''))
//                     const kv = new KeyVal(k, b)
//                     ctx.end()
//                     finish(kv)
//                 })
//             }
//             if (chars.length === 0) {
//                 ctx.error(ctx.range(), 'No key here')
//             }
//             return ctx.callNoFirst(block, b => {
//                 const k = new Key(ctx.range(), chars.join(''))
//                 const kv = new KeyVal(k, b)
//                 ctx.end()
//                 finish(kv)
//             })
//         } else if (c === '[') {
//             if (charsEnd) { 
//                 return ctx.callNoFirst(arr, a => {
//                     const k = new Key(charsRange!, chars.join(''))
//                     const kv = new KeyVal(k, a)
//                     ctx.end()
//                     finish(kv)
//                 })
//             }
//             if (chars.length === 0) {
//                 ctx.error(ctx.range(), 'No key here')
//             }
//             return ctx.callNoFirst(arr, a => {
//                 const k = new Key(ctx.range(), chars.join(''))
//                 const kv = new KeyVal(k, a)
//                 ctx.end()
//                 finish(kv)
//             })
//         } else if (c === ',') {
//             ctx.flag()
//             ctx.error(ctx.range(), 'There should be a value here')
//             ctx.end()
//             return ReDo
//         } else {
//             if (charsEnd) {
//                 return ctx.callNoFirst(val, v => {
//                     const k = new Key(charsRange!, chars.join(''))
//                     const kv = new KeyVal(k, v)
//                     ctx.end()
//                     finish(kv)
//                 })
//             } else chars.push(c)
//         }
//     }
// }

// function val(ctx: Ctx, finish: (unit: Unit) => void) {
//     return (c: char) => {
//         if (c === EOF) {
//             ctx.flag()
//             ctx.error(ctx.range(), 'There should be a value here')
//             ctx.end()
//             return ReDo
//         } else if (reg_Space.test(c)) {
//             return
//         } else if (c === ',' || c === ':' || c === '=' || c === ']' || c === '}') {
//             ctx.flag()
//             ctx.error(ctx.range(), 'There should be a value here')
//             ctx.end()
//             finish(null as any)
//             return ReDo
//         } else if (reg_Num.test(c)) {
//             return ctx.call(num, n => {
//                 ctx.end()
//                 finish(n)
//             })
//         } else if (c === '"' || c === "'") {
//             return ctx.callNoFirst(str, c, s => {
//                 ctx.end()
//                 finish(s)
//             })
//         } else if (c === '{') {
//             return ctx.callNoFirst(block, b => {
//                 ctx.end()
//                 finish(b)
//             })
//         } else if (c === '[') {
//             return ctx.callNoFirst(arr, a => {
//                 ctx.end()
//                 finish(a)
//             })
//         } else {
//             return ctx.call(keyword, u => {
//                 ctx.end()
//                 finish(u)
//             })
//         }
//     }
// }

// function num(ctx: Ctx, finish: (num: Num) => void) {
//     const int: string[] = []
//     const float: string[] = []
//     let dot = false
//     ctx.flag()
//     return (c: char) => { 
//         if (c === EOF) {
//             ctx.end()
//             return ReDo
//         } else if (c === '.') {
//             if (dot) {
//                 ctx.flag()
//                 ctx.error(ctx.range(), 'Number cannot be dot twice')
//             }
//             dot = true
//         } else if (reg_Num.test(c)) {
//             if (dot) float.push(c)
//             else int.push(c)
//         } else {
//             const n = Number(`${int.join('')}.${float.join('')}`)
//             ctx.end()
//             finish(new Num(ctx.range(true), n))
//             return ReDo
//         }
//     }
// }

// function str(ctx: Ctx, first: '"' | "'", finish: (s: Str) => void) {
//     const chars: string[] = []
//     ctx.flag()
//     return (c: char) => { 
//         if (c === EOF) {
//             ctx.flag()
//             ctx.error(ctx.range(), 'String is not closed')
//             ctx.end()
//             return ReDo
//         } else if (c === '"' || c === "'") {
//             if (c === first) {
//                 const s = new Str(ctx.range(), chars.join(''), first)
//                 ctx.end()
//                 finish(s)
//             } else {
//                 chars.push(c)
//             }
//         } else {
//             //todo escape
//             chars.push(c)
//         }
//     }
// }

// function keyword(ctx: Ctx, finish: (u: Bool | Null) => void) {
//     const chars: string[] = []
//     ctx.flag()
//     return (c: char) => { 
//         if (c === EOF) {
//             const kw = chars.join('')
//             const u = checkkeyword(kw, ctx.range())
//             if (u == null) {
//                 ctx.error(ctx.range(), 'Unknown keyword')
//             }
//             ctx.end()
//             return ReDo
//         } else if (reg_Space.test(c) || c === '"' || c === "'" || c === ':' || c === '=' || c === ',' || c === '[' || c === '{' || c === ']' || c === '}') {
//             const kw = chars.join('')
//             const u = checkkeyword(kw, ctx.range())
//             if (u == null) {
//                 ctx.error(ctx.range(), 'Unknown keyword')
//             } 
//             ctx.end()
//             finish(u!)
//             return ReDo
//         } else {
//             chars.push(c)
//         }
//     }
// }

// function checkkeyword(kw: string, range: TkRange) {
//     return kw === 'true' ? new Bool(range, true) : kw === 'false' ? new Bool(range, false) : kw === 'null' ? new Null(range) : null
// }