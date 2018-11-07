// rollup.config.js
import resolve from 'rollup-plugin-node-resolve';
import commonJS from 'rollup-plugin-commonjs'

export default {
    input: 'Docking.js',
    output: {
        file: 'DockingManager-rolledup.js',
        format: 'iife'
    },
    plugins: [
        resolve(),
        commonJS({
            include: 'node_modules/**'
        })
    ]
};