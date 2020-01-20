import { parser, stringify } from '../src/index'

(async () => {
    const s = stringify({ a: { b: 2 }, c: [1, 2.5] })
    console.log(s)

    const r = await parser(s!, { show_all_err: true, async: true })

    console.log(JSON.stringify(r))
})()
