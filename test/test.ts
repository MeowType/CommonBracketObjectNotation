import { parser } from '../src/parser'

const r = parser(`{
  a  1
  b  'string'
  c  "string"
  d  true
  e  { }
  f  [ 1, 2.5 ]
  g  null
}`)

console.log(r)
