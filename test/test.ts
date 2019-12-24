import { parser } from '../src/index'

const r = parser(`1{1,a:,[a:1,a`)

console.log(JSON.stringify(r))
