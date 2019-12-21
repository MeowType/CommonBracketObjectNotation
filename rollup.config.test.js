
import typescript from 'rollup-plugin-typescript2'

export default {
    input: './test/test.ts',
    output: {
        file: './test/test.js',
        format: 'iife',
        name: 'cbon_test',
        sourcemap: true,
    },
    plugins: [
        typescript({
            tsconfig: './tsconfig.test.json'
        }),
    ]
};