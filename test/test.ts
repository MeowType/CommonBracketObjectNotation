import { parser } from '../src/index'

const r = parser(`[123_456 1, 2.5 3. .4 5e3 0xaF]`, { show_all_err: true })

console.log(JSON.stringify(r))