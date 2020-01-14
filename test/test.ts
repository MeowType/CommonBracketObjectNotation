import { parser } from '../src/index'

(async () => {
    const r = await parser(`{a '\\n\\r\\u{2a5f}'}`, { show_all_err: true, async: true })

    console.log(JSON.stringify(r))
})()