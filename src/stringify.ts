
export interface ToCbon {
    tocbon(): string
}

export type StringifyFormat = {
    string?: '"' | "'",
    splitter?: null | ':' | '=',
    comma?: boolean,
    comma_when_only_one_line?: boolean,
    split_before_brackets?: boolean,
    strict_string?: boolean,
    strict_key?: boolean,
    tab: ' ' | '\t',
    tab_count: number
}
export type FullStringifyFormat = Required<StringifyFormat>
export const DefaultFormat = {
    string: "'",
    splitter: null,
    comma: false,
    comma_when_only_one_line: true,
    split_before_brackets: false,
    strict_string: false,
    strict_key: false,
    tab: ' ',
    tab_count: 2
} as const
export const MinFormat = {
    ...DefaultFormat,
    comma_when_only_one_line: false,
} as const
export const JsonFormat = {
    ...DefaultFormat,
    string: '"',
    splitter: ':',
    comma: true,
    split_before_brackets: true,
    strict_string: true,
    strict_key: true,
} as const

export type StringifyStyle = 'min' | null | 'beautify'

export function styleFormat(style: 'min'): typeof MinFormat
export function styleFormat(style?: null | 'beautify'): typeof DefaultFormat
export function styleFormat(style?: StringifyStyle): FullStringifyFormat
export function styleFormat(style?: StringifyStyle): FullStringifyFormat {
    return style === 'min' ? MinFormat : DefaultFormat
}

export function stringify(val: any, config?: { style?: StringifyStyle, format?: StringifyFormat }): string | undefined {
    const style = config?.style ?? null
    const format = { ...styleFormat(style), ...(config?.format ?? {}) }
    const obj_ref_pool = new Set<object>()
    return _stringify(val, style === 'beautify', format, obj_ref_pool)
}

const reg_quote_s = /'/ug
const reg_quote_d = /d/ug
const reg_not_word = /["'\s]|true|false|null/u
const reg_first_num = /[\d\-\+]/u
function is_word(val: string) {
    return is_key(val) && !reg_first_num.test(val[0])
}
function is_key(val: string) {
    return val.length > 0 && !reg_not_word.test(val)
}
function _stringify(val: any, beautify: boolean, format: FullStringifyFormat, obj_ref_pool: Set<object>): string | undefined {
    //todo beautify
    const { string, comma, splitter } = format
    if (typeof val === 'string') {
        if (is_word(val)) return val
        const nv = val.replace(string === '"' ? reg_quote_d : reg_quote_s, `\\${string}`)
        return `${string}${nv}${string}`
    } else if (typeof val === 'number' || typeof val === 'bigint' || typeof val === 'boolean') {
        return `${val}`
    } else if (val == null) return `null`
    else if (typeof val === 'object') {
        if (obj_ref_pool.has(val)) {
            throw TypeError('Converting circular structure to CBON')
        }
        obj_ref_pool.add(val)
        const getfn = val['toCBON'] ?? val['toJSON']
        if (typeof getfn === 'function') return getfn()
        if (val instanceof Array) {
            const outmap = val.map(v => {
                const r = _stringify(v, beautify, format, obj_ref_pool)
                if (r === undefined) return `null`
                else return r
            })
            const str = outmap.join(comma ? ',' : ' ')
            obj_ref_pool.delete(val)
            return `[${str}]`
        } else {
            const kvs: [string, string][] = []
            for (const k in val) {
                const v = val[k]
                const r = _stringify(v, beautify, format, obj_ref_pool)
                if (r !== undefined) {
                    kvs.push([is_key(k) ? k : `${string}${k}${string}`, r])
                }
            }
            const str = kvs.map(kv => kv.join(splitter ?? ' ')).join(comma ? ',' : ' ')
            obj_ref_pool.delete(val)
            return `{${str}}`
        }
    } else {
        return void 0
    }
}