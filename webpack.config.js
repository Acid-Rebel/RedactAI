const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const webpack = require('webpack');

module.exports = (env, argv) => {
  const isDev = argv.mode === 'development';

  return {
    entry: {
      background: './src/background.js',
      content: './src/content.js',
      popup: './src/popup.js',
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
      publicPath: '',
      clean: true,
    },
    module: {
      rules: [
        {
          test: /\.css$/,
          use: [MiniCssExtractPlugin.loader, 'css-loader'],
        },
      ],
    },
    plugins: [
      new MiniCssExtractPlugin({ filename: '[name].css' }),
      new CopyPlugin({
        patterns: [
          { from: 'manifest.json', to: 'manifest.json' },
          { from: 'icons', to: 'icons' },
          { from: 'src/popup.html', to: 'popup.html' },
          {
            from: 'node_modules/pdfjs-dist/build/pdf.worker.min.js',
            to: 'pdf.worker.js',
          },
        ],
      }),
      new webpack.optimize.LimitChunkCountPlugin({
        maxChunks: 1, // Disable chunking entirely for content scripts
      }),
    ],
    optimization: {
      splitChunks: false,
    },
    resolve: {
      fallback: {
        canvas: false,
        fs: false,
        path: false,
        url: false,
        stream: false,
        buffer: false,
        crypto: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        util: false,
      },
    },
    devtool: isDev ? 'inline-source-map' : false,
    performance: {
      maxAssetSize: 5 * 1024 * 1024,
      maxEntrypointSize: 5 * 1024 * 1024,
    },
  };
};
