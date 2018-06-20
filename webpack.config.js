'use strict';

module.exports = {
  entry: './src/index.js',
  output: {
    filename: "bundle.js",
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
          presets: ["babel-preset-env"]
        }
      }
    }]
  }
};
