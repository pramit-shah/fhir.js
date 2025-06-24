var webpack = require("webpack");
var path = require("path");

module.exports = {
  mode: 'production',
  entry: {
    fhir: ["./src/fhir.js"],
    ngFhir: "./src/adapters/angularjs.js",
    jqFhir: "./src/adapters/jquery.js",
    yuifhir: "./src/adapters/yui.js",
    nativeFhir: "./src/adapters/native.js"
  },
  module: {
    rules: [
      { test: /\.coffee$/, use: "coffee-loader" },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', {
                targets: {
                  browsers: ['last 2 versions', 'ie >= 11']
                },
                modules: 'auto',
                useBuiltIns: 'usage',
                corejs: 3
              }]
            ],
            plugins: [
              ['@babel/plugin-transform-runtime', {
                regenerator: true,
                helpers: true,
                corejs: 3
              }]
            ]
          }
        }
      }
    ]
  },
  externals: {"jquery": "jQuery"},
  resolve: {
    extensions: [".webpack.js", ".web.js", ".js", ".coffee", ".less"]
  },
  output: {
    path: path.join(__dirname, "dist"),
    filename: "[name].js",
    library: "fhir",
    libraryTarget: "umd"
  }
};
