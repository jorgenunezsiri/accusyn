'use strict';

const ExtractTextPlugin = require('extract-text-webpack-plugin');

module.exports = {
  entry: [
    'babel-polyfill',
    './src/index.js',
    './src/index.css'
  ],
  output: {
    filename: 'bundle.js',
    path: __dirname + '/build/',
    publicPath: '/'
  },
  devServer: {
    contentBase: './build',
    disableHostCheck: true,
    inline: true,
    port: 8080
  },
  module: {
    rules: [{
        test: /\.js$/,
        exclude: /node_modules|circos/,
        use: {
          loader: 'babel-loader',
          options: {
            // babel-loader is told to use the babel-preset-env package installed earlier,
            // to establish the transpile parameters set in the .babelrc file.
            // babel-preset-react is used to transpile jsx correctly
            presets: ['babel-preset-env', 'babel-preset-react']
          }
        }
      },
      {
        test: /\.css$/,
        use: ExtractTextPlugin.extract({
          loader: 'css-loader',
          options: {
            minimize: false
          }
        })
      }
    ]
  },
  plugins: [
    new ExtractTextPlugin({
      filename: 'bundle.css'
    })
  ]
};
