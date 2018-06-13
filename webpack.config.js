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
    }
};
