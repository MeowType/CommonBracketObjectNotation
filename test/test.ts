import { parser } from '../src/index'

const r = parser(`{a :1}`)

console.log(JSON.stringify(r))
