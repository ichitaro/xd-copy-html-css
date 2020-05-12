const production = process.env.NODE_ENV === 'production'

module.exports = {
  devtool: production ? false : 'inline-source-map',
  entry: {
    main: './src/main.js'
  },
  output: {
    filename: '[name].js',
    path: __dirname + '/dist',
    libraryTarget: 'commonjs2'
  },
  externals: {
    uxp: 'uxp',
    application: 'application',
    scenegraph: 'scenegraph',
    clipboard: 'clipboard',
    commands: 'commands'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        loader: 'transform-loader?brfs'
      }
    ]
  },
  node: { fs: 'empty' }
}
