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

/**  == queueMicrotask */
export function next_micro_tick(): Promise<void> {
    return new Promise(res => res())
}

/** == setTimeout */
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

export interface MaybeAsyncIterable<T> {
    [Symbol.iterator]?: () => Iterator<T>;
    [Symbol.asyncIterator]?: () => AsyncIterator<T>;
}

export function getIterator<T>(iter: AsyncIterable<T>): AsyncIterator<T>
export function getIterator<T>(iter: Iterable<T>): Iterator<T>
export function getIterator<T>(iter: MaybeAsyncIterable<T>): (AsyncIterator<T> ) | (Iterator<T>)
export function getIterator<T>(iter: MaybeAsyncIterable<T>) {

    return iter[Symbol.asyncIterator] != null ? iter[Symbol.asyncIterator]!() : iter[Symbol.iterator]!()
}