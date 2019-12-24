import { Errors } from "./type";

export function isVoid(v: any): v is void {
    return v == null
}

export function getErrorsMsgs(errors: Errors[]) {
    return errors.flatMap(e => [`${e.msg}`, `    at ${e.range.from.line + 1}:${e.range.from.char + 1} to ${e.range.to.line + 1}:${e.range.to.char + 1}`])
}