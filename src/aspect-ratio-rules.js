const cssRules = require('./css-rules')
const { encodePercent } = require('./encode-style')

const BEFORE = 'before'
const AFTER = 'after'
const aspectRatioRules = {
  BEFORE,
  AFTER,
  attach(vnode, { width, height }, side = BEFORE) {
    const rules = []
    if (vnode.children.length > 0) {
      rules.push({
        selector: ':scope',
        style: {
          position: 'relative'
        }
      })
    }
    rules.push({
      selector: `:scope::${side}`,
      style: {
        display: 'block',
        'padding-top': encodePercent(height, width),
        content: `''`
      }
    })
    cssRules.add(vnode, rules)
    vnode._contentHeight = 'auto'
    return vnode
  }
}

module.exports = aspectRatioRules
