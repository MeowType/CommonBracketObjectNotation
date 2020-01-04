import { parser } from '../src/index'

const r = parser(`//asd\n/*asd*#*/{a:1}`, { show_all_err: true })

console.log(JSON.stringify(r))