import { parser } from '../src/index'

(async () => {
    const r = await parser(`//asd\n/*asd*#*/{a:1}`, { show_all_err: true, async: true })

    console.log(JSON.stringify(r))
})()