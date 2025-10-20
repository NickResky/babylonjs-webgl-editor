// Configuration to run playground test application
const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');
const webpack = require('webpack');
module.exports = {
    entry: './playground/src/porsche/cws-v1-and-local.resolver.ts',
    mode: 'production',
    output: {
      filename: 'resolver.min.js',
      path: path.resolve(__dirname, 'vanilla-js-sandbox/dist/porsche'),
      library: {
        name: 'cwsLocalResolver',
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
