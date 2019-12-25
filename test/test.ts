import { parser } from '../src/index'
import { tokenizer } from '../src/tokenizer'
import { TWord, TNum, TSymbol, TStr } from '../src/token'

//const r = parser(`{a :1}`)

//console.log(JSON.stringify(r))

const t = tokenizer(`{a :1}`)
if (t.type === 'tokens') {
    const m = t.val.map(v => {
        if (v instanceof TNum) {
            return `${v.constructor.name}: ${v.val}`
        }
        if (v instanceof TWord || v instanceof TSymbol) {
            return `${v.constructor.name}: '${v.val}'`
        }
        if (v instanceof TStr) {
            return `${v.constructor.name}: "${v.val}"(${v.col})`
        }
        return `${v.constructor.name}`
    })
    console.log(m.join('\n'))
} else {
    console.log(JSON.stringify(t.val))
}