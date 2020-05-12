const sg = require('scenegraph')
const transformStack = require('./transform-stack')
const { createElement } = require('./vnode')
const cssRules = require('./css-rules')
const {
  opacityStyle,
  getImageFillURL,
  boxStyle,
  boxStyleAndImage,
  getInnerBorderWidth
} = require('./node-style')
const nearlyEq = require('./number-nearly-eq')
const { getPosition } = require('./node-position')
const options = require('./options')

function getBaseRectangle(node) {
  const baseRect = node.children.at(0)
  if (!(baseRect instanceof sg.Rectangle) || !baseRect.visible) {
    return null
  }
  const pos = getPosition(baseRect)
  const isFull =
    nearlyEq(pos.width, pos.container.width) &&
    nearlyEq(pos.height, pos.container.height)
  if (!isFull) {
    return null
  }
  return baseRect
}

const containerRule = {
  selector: ':scope',
  style: {
    position: 'relative',
    'z-index': '0'
  }
}

const fullBGStyle = {
  position: 'absolute',
  top: '0',
  left: '0',
  'z-index': '-1',
  width: '100%',
  height: '100%'
}

function _mergeBaseRectangle({ baseRect }, vnode) {
  if (baseRect === null) {
    return null
  }

  const hasImageFill = baseRect.fill instanceof sg.ImageFill
  if (hasImageFill && options.get(baseRect)['inline']) {
    const img = createElement('img', {
      src: getImageFillURL(baseRect)
    })
    img._prefix = `${vnode._prefix}-image`
    cssRules.add(img, {
      selector: ':scope',
      style: {
        ...opacityStyle(baseRect),
        ...boxStyle(baseRect),
        ...fullBGStyle,
        'object-fit': 'cover'
      }
    })
    vnode.children.push(img)
    cssRules.add(vnode, containerRule)
    return baseRect
  }

  if (getInnerBorderWidth(baseRect) === 0 && baseRect.opacity >= 1) {
    const { boxStyle, imageStyle } = boxStyleAndImage(baseRect)
    cssRules.add(vnode, {
      selector: ':scope',
      style: boxStyle
    })
    if (imageStyle != null) {
      vnode.setAttr('style', imageStyle)
    }
    return baseRect
  }

  if (hasImageFill) {
    const rect = createElement('div')
    rect._prefix = `${vnode._prefix}-image`
    const { boxStyle, imageStyle } = boxStyleAndImage(baseRect)
    cssRules.add(rect, {
      selector: ':scope',
      style: {
        ...opacityStyle(baseRect),
        ...boxStyle,
        ...fullBGStyle
      }
    })
    if (imageStyle != null) {
      rect.setAttr('style', imageStyle)
    }
    vnode.children.push(rect)
    cssRules.add(vnode, containerRule)
    return baseRect
  }

  cssRules.add(vnode, [
    containerRule,
    {
      selector: ':scope::before',
      style: {
        ...opacityStyle(baseRect),
        ...boxStyle(baseRect),
        ...fullBGStyle,
        content: `''`
      }
    }
  ])
  return baseRect
}

function compareSegment(a, b) {
  return a[0] - b[0]
}

function getGroupType(node) {
  const type = options.get(node)['type']
  if (type === 'a' || type === 'absolute') {
    return { isStack: false }
  }
  if (type === 'v' || type === 'v-stack' || type === true) {
    return { isStack: true, isVertical: true }
  }
  if (type === 'h' || type === 'h-stack') {
    return { isStack: true, isVertical: false }
  }
  return null
}

function hasOverlap(segments) {
  if (segments.length < 2) {
    return false
  }

  segments.sort(compareSegment)
  for (let i = 0, last = segments.length - 1; i < last; i++) {
    if (segments[i][1] > segments[i + 1][0]) {
      return true
    }
  }
  return false
}

function guessGroupType(node, filterChild) {
  const vSegments = []
  const hSegments = []
  node.children.forEach(child => {
    if (!filterChild(child)) {
      return
    }

    const pos = getPosition(child)
    vSegments.push([pos.top, pos.top + pos.height])
    hSegments.push([pos.left, pos.left + pos.width])
  })

  if (!hasOverlap(vSegments)) {
    return { isStack: true, isVertical: true }
  }

  if (!hasOverlap(hSegments)) {
    return { isStack: true, isVertical: false }
  }

  return { isStack: false }
}

async function transformGroup(node, context) {
  if (!(node instanceof sg.Group || node instanceof sg.Artboard)) {
    return null
  }

  if (node.mask) {
    return null
  }

  const baseRect = getBaseRectangle(node)
  const userGroupType = getGroupType(node)
  const groupType =
    userGroupType ||
    guessGroupType(node, child => {
      return (
        child !== baseRect && child.visible && !options.get(child)['absolute']
      )
    })

  const mergeBaseRectangle = _mergeBaseRectangle.bind(null, {
    isStack: groupType.isStack,
    node,
    baseRect
  })

  if (userGroupType === null && !groupType.isStack) {
    context.warnings.push(
      `Each element in the group must be aligned vertically or horizontally. Otherwise, every elements will be put in an absolute position.`
    )
  }

  return transformStack(node, { ...context, mergeBaseRectangle, groupType })
}

module.exports = transformGroup
