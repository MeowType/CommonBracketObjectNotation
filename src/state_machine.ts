import { Errors } from "./type"
import { isVoid } from "./utils"
import { TkPos, TkRange } from "./pos"

type TailParams<T extends (...a: any[]) => any> = T extends (_: any, ...a: infer L) => any ? L : never


export const ReDo = Symbol('ReDo')
export type BaseParserUnit<Char> = (c: Char) => void | typeof ReDo | ParserUnit<Char>
export type ParserUnitFn<Char> = (ctx: Context<Char>, ...a: any[]) => BaseParserUnit<Char>
export interface ParserUnit<Char> {
    fn: BaseParserUnit<Char>
    ignoreFirst: boolean
}

export class WhenError extends Error {
    err: Errors
    constructor(err: Errors) {
        super()
        this.err = err
    }
}

export class State<Char> {
    count = 0
    char = 0
    line = 0
    states: BaseParserUnit<Char>[] = []
    lines: number[] = []
    errors: Errors[] = []
    show_all_err: boolean

    constructor(show_all_err: boolean) {
        this.show_all_err = show_all_err
    }
    push(unit: BaseParserUnit<Char>) {
        this.states.push(unit)
    }
    pop() {
        return this.states.pop()
    }
    call(c: Char): void {
        const r = this.states[this.states.length - 1](c)
        if (!isVoid(r)) {
            if (r === ReDo) {
                this.call(c)
            } else {
                const { fn, ignoreFirst } = r
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

export class Context<Char> {
    state: State<Char>
    last_flag?: TkPos
    constructor(state: State<Char>) {
        this.state = state
    }
    end() {
        this.state.pop()
    }
    call<F extends ParserUnitFn<Char>>(f: F, ...p: TailParams<F>): ParserUnit<Char> {
        return {
            fn: f(new Context(this.state), ...p),
            ignoreFirst: false
        }
    }
    callNoFirst<F extends ParserUnitFn<Char>>(f: F, ...p: TailParams<F>): ParserUnit<Char> {
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
        if (!this.state.show_all_err) throw new WhenError({ range, msg })
        this.state.errors.push({ range, msg })
    }
}