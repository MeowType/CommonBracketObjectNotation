import { TailParams } from "./type";
import { next_micro_tick } from "./utils";

export type Gen<T = any> = Generator<RecursiveYield | undefined, T, RecursiveNext>
export type GenRet<T extends Gen> = T extends Gen<infer R> ? R : never
export type GenFnRet<F extends (...a: any[]) => Gen> = ReturnType<F> extends Gen<infer R> ? R : never
export type RecursiveYield<T = any> = () => Gen<T>
export type RecursiveNext<T = any> = T

export class RecursiveCtx {
    get<F extends (ctx: RecursiveCtx, ...args: any[]) => Gen>(_: F, result: RecursiveNext<GenFnRet<F>>): GenFnRet<F> {
        return result
    }

    call<F extends (ctx: RecursiveCtx, ...args: any[]) => Gen>(fn: F, ...args: TailParams<F>): RecursiveYield<GenFnRet<F>> {
        return () => fn(this, ...args)
    }
}

export function doRecursive<F extends (ctx: RecursiveCtx, ...args: any[]) => Gen>(fn: F, ...args: TailParams<F>): GenFnRet<F> {
    const ctx = new RecursiveCtx
    const gens: Gen[] = [fn(ctx, ...args)]
    let v: any = undefined
    while (gens.length > 0) {
        const gen = gens[gens.length - 1]
        const now = gen.next(v)
        v = undefined
        if (now.done) {
            gens.pop()
            v = now.value
        } else {
            const ngen = now.value?.()
            if (ngen != null) {
                gens.push(ngen)
            }
        }
    }
    return v
}

export async function doRecursiveAsync<F extends (ctx: RecursiveCtx, ...args: any[]) => Gen>(fn: F, ...args: TailParams<F>): Promise<GenFnRet<F>> {
    const ctx = new RecursiveCtx
    const gens: Gen[] = [fn(ctx, ...args)]
    let v: any = undefined
    do {
        const gen = gens[gens.length - 1]
        const now = gen.next(v)
        v = undefined
        if (now.done) {
            gens.pop()
            v = now.value
        } else {
            const ngen = now.value?.()
            if (ngen != null) {
                gens.push(ngen)
            }
        }
    } while (gens.length > 0 ? (await next_micro_tick(), true) : false)
    return v
}