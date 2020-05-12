const { Color, Rectangle, selection } = require('scenegraph')
const nearlyEq = require('./number-nearly-eq')

function saveStateAndInit(parent) {
  const children = parent.children.map(node => {
    const visible = node.visible
    node.visible = true
    return { node, visible }
  })

  const parentBounds = parent.localBounds
  const innerBB = {
    x0: parentBounds.x + parentBounds.width,
    y0: parentBounds.y + parentBounds.height,
    x1: parentBounds.x,
    y1: parentBounds.y
  }
  for (const child of children) {
    const bounds = child.node.boundsInParent
    child.bounds = bounds
    innerBB.x0 = Math.min(innerBB.x0, bounds.x)
    innerBB.y0 = Math.min(innerBB.y0, bounds.y)
    innerBB.x1 = Math.max(innerBB.x1, bounds.x + bounds.width)
    innerBB.y1 = Math.max(innerBB.y1, bounds.y + bounds.height)
  }

  // This is necessary to avoid limits on their ability to resize
  const rect = new Rectangle()
  rect.width = innerBB.x1 - innerBB.x0
  rect.height = innerBB.y1 - innerBB.y0
  rect.fill = new Color('transparent')
  rect.stroke = null
  parent.addChild(rect)
  rect.moveInParentCoordinates(innerBB.x0, innerBB.y0)

  return {
    parentBounds,
    children,
    restore() {
      rect.removeFromParent()
      for (const { node, visible } of children) {
        node.visible = visible
      }
    }
  }
}

const delta = 100
function calcChildrenConstraints(node) {
  if (node == null || !selection.isInEditContext(node)) {
    return null
  }

  const { parentBounds, children, restore } = saveStateAndInit(node)

  node.resize(parentBounds.width + delta, parentBounds.height + delta)

  const newParentBounds = node.localBounds
  for (const child of children) {
    child.newBounds = child.node.boundsInParent
  }

  node.resize(parentBounds.width, parentBounds.height)

  restore()

  const containerSize = {
    width: parentBounds.width,
    height: parentBounds.height
  }
  const constraintsByChild = children.reduce(
    (map, { node, bounds, newBounds }) => {
      const right0 =
        parentBounds.x + parentBounds.width - (bounds.x + bounds.width)
      const right1 =
        newParentBounds.x +
        newParentBounds.width -
        (newBounds.x + newBounds.width)
      const bottom0 =
        parentBounds.y + parentBounds.height - (bounds.y + bounds.height)
      const bottom1 =
        newParentBounds.y +
        newParentBounds.height -
        (newBounds.y + newBounds.height)
      const cstr = {
        container: containerSize,
        left: {
          fixed: nearlyEq(bounds.x, newBounds.x),
          value: bounds.x - parentBounds.x
        },
        width: {
          fixed: nearlyEq(bounds.width, newBounds.width),
          value: bounds.width
        },
        right: {
          fixed: nearlyEq(right0, right1),
          value: right0
        },
        top: {
          fixed: nearlyEq(bounds.y, newBounds.y),
          value: bounds.y - parentBounds.y
        },
        height: {
          fixed: nearlyEq(bounds.height, newBounds.height),
          value: bounds.height
        },
        bottom: {
          fixed: nearlyEq(bottom0, bottom1),
          value: bottom0
        }
      }
      return map.set(node.guid, cstr)
    },
    new Map()
  )

  return {
    container: containerSize,
    constraintsByChild
  }
}

function constraintsPicker() {
  const layoutByContainer = new Map()
  const getLayout = node => {
    const id = node.guid
    if (!layoutByContainer.has(id)) {
      layoutByContainer.set(id, calcChildrenConstraints(node))
    }
    return layoutByContainer.get(id)
  }

  return {
    clear() {
      layoutByContainer.clear()
    },
    get(node) {
      const layout = getLayout(node.parent)
      return layout && layout.constraintsByChild.get(node.guid)
    },
    getSize(node) {
      const layout = getLayout(node)
      return layout && layout.container
    }
  }
}

const sharedPicker = constraintsPicker()

module.exports = sharedPicker
