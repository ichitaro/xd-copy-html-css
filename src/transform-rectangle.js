const sg = require('scenegraph')
const { createElement } = require('./vnode')
const cssRules = require('./css-rules')
const {
  getImageFillURL,
  boxStyle,
  boxStyleAndImage,
  borderStyle,
  borderRadiusStyle,
  shadowStyle,
  getInnerBorderWidth
} = require('./node-style')
const aspectRatioRules = require('./aspect-ratio-rules')
const { opacityStyle } = require('./node-style')
const options = require('./options')

function _transformRectangle(node) {
  const vnode = createElement('div')
  vnode._prefix = options.get(node)._className || 'rect'

  const hasImageFill = node.fill instanceof sg.ImageFill
  if (!hasImageFill || !options.get(node)['inline']) {
    const { boxStyle, imageStyle } = boxStyleAndImage(node)
    cssRules.add(vnode, {
      selector: ':scope',
      style: boxStyle
    })
    if (imageStyle != null) {
      vnode.setAttr('style', imageStyle)
    }
    return vnode
  }

  const img = createElement('img', { src: getImageFillURL(node) })
  img._prefix = `${vnode._prefix}-image`
  cssRules.add(img, {
    selector: ':scope',
    style: {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      'object-fit': 'cover'
    }
  })
  vnode.children.push(img)
  cssRules.add(vnode, [
    {
      selector: ':scope',
      style: {
        position: 'relative',
        overflow: node.hasRoundedCorners ? 'hidden' : null
      }
    }
  ])

  if (getInnerBorderWidth(node) === 0) {
    cssRules.add(vnode, {
      selector: ':scope',
      style: boxStyle(node)
    })
    return vnode
  }

  cssRules.add(vnode, [
    {
      selector: ':scope',
      style: {
        ...borderRadiusStyle(node),
        ...shadowStyle(node)
      }
    },
    {
      selector: ':scope::after',
      style: {
        ...borderStyle(node),
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        content: `''`,
        'border-radius': node.hasRoundedCorners ? 'inherit' : null
      }
    }
  ])
  return vnode
}

function transformRectangle(node) {
  if (!(node instanceof sg.Rectangle)) {
    return null
  }

  const vnode = _transformRectangle(node)
  cssRules.add(vnode, {
    selector: ':scope',
    style: opacityStyle(node)
  })
  if (
    node.fill.scaleBehavior === sg.ImageFill.SCALE_STRETCH ||
    options.get(node)['aspect-ratio']
  ) {
    aspectRatioRules.attach(vnode, node.localBounds)
  }

  return vnode
}

module.exports = transformRectangle
