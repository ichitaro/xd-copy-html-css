const { parse, parseFragment } = require('parse5')
const Parser = require('../node_modules/html-pug-converter/src/parser.js')

module.exports = (sourceHtml, { tabs = false, fragment = false } = {}) => {
  const parser = new Parser({
    root: fragment ? parseFragment(sourceHtml) : parse(sourceHtml),
    tabs
  })

  return parser.parse()
}
