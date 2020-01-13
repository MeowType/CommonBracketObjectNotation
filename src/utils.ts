import { Errors } from "./type";

export function isVoid(v: any): v is void {
    return v == null
}

export function getErrorsMsgs(errors: Errors[]) {
    return errors.flatMap(e => [`${e.msg}`, `    at ${e.range.from.line + 1}:${e.range.from.char + 1} to ${e.range.to.line + 1}:${e.range.to.char + 1}`])
}

export function showErr(errmsg: string[]): never {
    throw new SyntaxError(`\n    ${errmsg.join('\n    ')}\n`)
}

export function next_micro_tick(): Promise<void> {
    return new Promise(res => res())
}

export function next_macro_tick(): Promise<void> {
    return new Promise(res => {
        setTimeout(res)
    })
}

export function delay(timeout?: number): Promise<void> {
    return new Promise(res => {
        setTimeout(res, timeout)
    })
}