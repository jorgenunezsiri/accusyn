'use strict';

const ExtractTextPlugin = require('extract-text-webpack-plugin');
const SpriteLoaderPlugin = require('svg-sprite-loader/plugin');
const webpack = require('webpack');

module.exports = {
  entry: [
    'babel-polyfill',
    './src/index.js',
    './src/styles/index.scss'
  ],
  output: {
    filename: 'bundle.js',
    path: __dirname + '/build/',
    publicPath: '/'
  },
  module: {
    rules: [{
        test: /\.js$/,
        exclude: /node_modules/,
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
        test: /\.js$/,
        loader: 'strip-loader?strip[]=console.log,strip[]=console.warn'
      },
      {
        test: /\.scss$/,
        use: ExtractTextPlugin.extract({
          use: [{
            loader: 'css-loader',
            options: {
              minimize: true
            }
          }, {
            loader: 'sass-loader'
          }]
        })
      },
      {
        test: /\.svg$/,
        loader: 'svg-sprite-loader',
        options: {
          extract: true,
          spriteFilename: 'images/icons.svg'
        }
      }
    ]
  },
  node: {
    child_process: 'empty'
  },
  plugins: [
    new SpriteLoaderPlugin({
      plainSprite: true
    }),
    new ExtractTextPlugin({
      filename: 'bundle.css'
    }),
    // Makes some environment variables available to the JS code, for example:
    // if (process.env.NODE_ENV === 'production') { ... }.
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify('production')
      }
    })
  ]
};
