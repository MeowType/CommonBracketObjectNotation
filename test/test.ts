import { parser } from '../src/index'

const r = parser(`[
123
]`)

console.log(JSON.stringify(r))
