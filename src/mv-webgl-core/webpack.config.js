// Configuration to run playground test application
const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');
const webpack = require('webpack');

const ASSET_PATH = path.join(__dirname, 'assets');
const APPLICATION_PATH = path.join(__dirname, 'playground');

module.exports = function (env) {
    let envFilePath = 'environment/environment.ts';
    if (env === 'dev') {
        envFilePath = 'environment/environment.dev.ts';
    }

    console.log('### Webpack ###');
    console.log(env);
    console.log(`Using path to env: ${envFilePath}`);
    console.log('###############');

    return {
        mode: 'development',
        entry: {
            app: './playground/src/main.ts',
        },
        output: {
            filename: '[name].[contenthash].js',
            path: __dirname + '/playground/dist',
        },
        devServer: {
            static: {
                directory: APPLICATION_PATH,
            },
            compress: true,
            port: 4200,
        },
        resolve: {
            extensions: ['.ts', '.js', '.jpg', '.glb', 'gltf', 'bin'],
            alias: {
                'mv-webgl-core': path.resolve(__dirname, 'src/'),
                [path.resolve(__dirname, 'environment/environment.ts')]: path.resolve(__dirname, envFilePath),
            },
        },
        module: {
            rules: [
                {
                    test: /\.ts$/,
                    use: 'ts-loader',
                },
                {
                    test: /\.(png|svg|jpg|gif)$/,
                    use: ['file-loader'],
                },
                {
                    test: /\.(glb|gltf|bin)$/,
                    use: ['file-loader'],
                },
            ],
        },
        devtool: 'source-map',
        plugins: [
            new HtmlWebpackPlugin({ template: 'playground/index.html' }),
            new webpack.ProvidePlugin({
                process: 'process/browser',
            }),
        ],
        optimization: {
            splitChunks: {
                chunks: 'all',
            },
        },
    };
};
