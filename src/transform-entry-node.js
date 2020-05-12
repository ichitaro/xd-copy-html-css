const sg = require('scenegraph')
const transformRectangle = require('./transform-rectangle')
const transformText = require('./transform-text')
const transformRuledLine = require('./transform-ruled-line')
const transformSVG = require('./transform-svg')
const transformGroup = require('./transform-group')
const cssRules = require('./css-rules')
const { encodeLength } = require('./encode-style')
const options = require('./options')

function transformMarkedSVG(node, context) {
  if (options.get(node)['svg'] || node.rotation !== 0) {
    return transformSVG(node, context)
  }
  return null
}

function alertUnsupportedTypes(node, context) {
  if (
    node instanceof sg.SymbolInstance ||
    node instanceof sg.RepeatGrid ||
    node instanceof sg.LinkedGraphic ||
    node instanceof sg.Group ||
    node instanceof sg.Artboard
  ) {
    context.warnings.push(
      `Components, Repeat Grid, Linked Assets, and Masked Groups are exported as SVG unless un-grouping.`
    )
  }
  return null
}

const allTransforms = [
  transformMarkedSVG,
  transformRectangle,
  transformText,
  transformRuledLine,
  transformGroup,
  alertUnsupportedTypes,
  transformSVG
]

async function transformAnyNode(node, { warnings }) {
  for (const transform of allTransforms) {
    const vnode = await transform(node, { transformAnyNode, warnings })
    if (vnode !== null) {
      if (process.env.NODE_ENV !== 'production') {
        if (vnode.type !== 'tagged') {
          throw new TypeError(
            `The plugin must return a tagged element: ${JSON.stringify(vnode)}`
          )
        }
      }
      return vnode
    }
  }
  throw new Error('This should never happen')
}

function setDefaultSize(vnode, { width, height }) {
  const style = {}
  if (!vnode._contentWidth) {
    style.width = encodeLength(width)
  }
  if (!vnode._contentHeight) {
    style.height = encodeLength(height)
  }
  cssRules.add(vnode, {
    selector: ':scope',
    style
  })
}

async function transformEntryNode(node, context) {
  const vnode = await transformAnyNode(node, context)
  setDefaultSize(vnode, vnode._actualSize || node.localBounds)
  return vnode
}

module.exports = transformEntryNode
