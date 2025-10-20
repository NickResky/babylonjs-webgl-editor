// Configuration to run playground test application
const path = require('path');
const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
    entry: './src/index.ts',
    mode: 'production',
    output: {
      filename: 'webgl-core.min.js',
      path: path.resolve(__dirname, 'vanilla-js-sandbox/dist/porsche'),
      library: {
        name: 'webglCore',
        type: 'var',
      }
    },
    resolve: {
        extensions: ['.ts', '.js', '.jpg', '.glb', 'gltf', 'bin'],
        alias: {
            'mv-webgl-core': path.resolve(__dirname, 'src/'),
            process: 'process/browser'
        }
    },
    plugins: [
        new webpack.ProvidePlugin({
            process: 'process/browser',
        }),
        new CopyWebpackPlugin({
            patterns: [
                path.resolve(__dirname, "vanilla-js-sandbox", "src", "porsche", "index.html"),
                {
                    from: path.resolve(__dirname, "vanilla-js-sandbox", "src", "porsche", "porsche-demo.js"),
                    info: { minimized: true },
                },
            ]
        })
    ],
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: 'ts-loader',
            },
            {
                test: /\.(png|svg|jpg|gif)$/,
                use: ['file-loader']
            },
            {
                test: /\.(glb|gltf|bin)$/,
                use: ['file-loader']
            }
        ]
    }
  };
