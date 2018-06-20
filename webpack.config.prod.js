'use strict';

var webpack = require('webpack');

module.exports = {
  entry: './src/index.js',
  output: {
    filename: "bundle.js",
    path: __dirname + '/build/',
    publicPath: '/'
  },
  module: {
    rules: [{
        test: /\.js$/,
        exclude: /node_modules|circos/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ["babel-preset-env"]
          }
        }
      },
      {
        test: /\.js$/,
        loader: "strip-loader?strip[]=console.log,strip[]=console.warn"
      }
    ]
  },
  plugins: [
    // Makes some environment variables available to the JS code, for example:
    // if (process.env.NODE_ENV === 'production') { ... }.
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify('production')
      }
    })
  ]
};
