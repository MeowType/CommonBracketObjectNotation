import { parser, stringify } from '../src/index'

(async () => {
    const s = stringify({ a: { a: 2, b: 'asd', c: "\"'", d: '123', e: 'true', f: 'false', g: 'null' }, c: [1, null, 2.5], d: null, e: true, f: false })
    console.log(s)

    const r = await parser(s!, { show_all_err: true, async: true })

    console.log(JSON.stringify(r))
})()
