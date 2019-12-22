import { parser } from '../src/parser'

const r = parser(`{
  f [ 1, 2.5 ]
  g null
}`)

console.log(r)
