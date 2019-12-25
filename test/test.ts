import { parser } from '../src/index'

const r = parser(`1{1,a:,[a:1,a`, { show_all_err: true })

console.log(JSON.stringify(r))