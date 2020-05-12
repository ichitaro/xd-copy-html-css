const options = require('./options')

function _getGoodBounds(node) {
  const children = node.children.map(child => {
    const visible = child.visible
    if (options.get(child)['absolute']) {
      child.visible = false
    }
    return { node: child, visible }
  })

  const bounds = node.localBounds

  for (const { node, visible } of children) {
    node.visible = visible
  }

  return bounds
}

function getGoodBounds(node) {
  let bounds = node._goodBounds
  if (bounds == null) {
    bounds = _getGoodBounds(node)
    node._goodBounds = bounds
  }
  return bounds
}

function getPosition(node) {
  const outer = getGoodBounds(node.parent)
  const inner = node.boundsInParent
  return {
    container: {
      width: outer.width,
      height: outer.height
    },
    width: inner.width,
    height: inner.height,
    left: inner.x - outer.x,
    top: inner.y - outer.y,
    right: outer.x + outer.width - (inner.x + inner.width),
    bottom: outer.y + outer.height - (inner.y + inner.height)
  }
}

module.exports = {
  getPosition,
  getGoodBounds
}
