const path = require('path');

// configuration for build process with rollup
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import typescript from 'rollup-plugin-typescript2';
import generatePackageJson from 'rollup-plugin-generate-package-json'
import builtins from 'rollup-plugin-node-builtins';
import globals from 'rollup-plugin-node-globals';
import cleanup from 'rollup-plugin-cleanup';
import { terser } from "rollup-plugin-terser";
import MagicString from 'magic-string'

// @ts-ignore
import pkg from './package.json';

export default {
    input: 'src/index.ts',
    output: [
        {
            file: path.resolve(__dirname, 'outputs', 'mv-core-package/cjs', pkg.main),
            format: 'cjs' // export with commonjs module
        },
        {
            file: path.resolve(__dirname, 'outputs', 'mv-core-package/es', pkg.module),
            format: 'es' // export with es module
        }
    ],
    external: [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.peerDependencies || {}), 'rxjs/operators'],
    plugins: [
        resolve({
            // use "module" field for ES6 module if possible
            module: true,

            // use "main" field or index.js, even if it's not an ES6 module
            // (needs to be converted from CommonJS to ES6) see https://github.com/rollup/rollup-plugin-commonjs
            main: true,

            // pkg.browser will be ignored
            browser: true,
        }),
        commonjs({
            // non-CommonJS modules will be ignored, but you can also
            // specifically include/exclude files
            include: 'node_modules/**',  // Default: undefined

            // explicitly specify unresolvable named exports
            /* @example
            namedExports: { 'node_modules/uuid/index.js': ['v4'] },
            */
        }),
        cleanup({ extensions: '.ts', exclude: ['.d.ts'] }),
        globals(),
        builtins(),
        typescript({
            typescript: require('typescript'),
            exclude: 'node_modules/**',
            tsconfig: 'tsconfig.build.json'
        }),
        prependLog(),
        terser(),
        generatePackageJson({
            baseContents: (pkg) => ({
                name: pkg.name,
                main: pkg.main,
                types: pkg.types,
                description: pkg.description,
                private: true
            })
        })
    ]
};

function prependLog() {
    return {
        name: 'prepend-last-commit',
        async renderChunk(code, chunk, options) {

            const log = require('child_process')
                .execSync('git log -1 --oneline')
                .toString().trim();

            const hash = log.split(' ')[0];

            const magicString = new MagicString(code)
            magicString.prepend(`console.log('### CORE: ${hash} ###');`)

            return {
                code: magicString.toString(),
                map: magicString.generateMap({ hires: true })
            }
        },
    };
}
