const sg = require('scenegraph')
const { roundFloat, encodeLength, encodeColor } = require('./encode-style')
const nearlyEq = require('./number-nearly-eq')

function opacityStyle({ opacity }) {
  return opacity < 1
    ? {
        opacity: `${roundFloat(opacity)}`
      }
    : null
}

function linearGradientHelper(w, h, startX, startY, endX, endY) {
  const x1 = w * startX
  const y1 = h * startY
  const x2 = w * endX
  const y2 = h * endY
  const dx = x2 - x1
  const dy = y2 - y1
  const dLen = Math.sqrt(dx * dx + dy * dy)
  const ndx = dx / dLen
  const ndy = dy / dLen
  const a = Math.atan2(dx, -dy)
  const gradLineLen = Math.abs(w * Math.sin(a)) + Math.abs(h * Math.cos(a))
  const cx = w / 2
  const cy = h / 2
  return {
    angle: (180 * a) / Math.PI,
    mapStop(stop) {
      const sx = x1 + stop * dx - cx
      const sy = y1 + stop * dy - cy
      const pLen = sx * ndx + sy * ndy
      return 0.5 + pLen / gradLineLen
    }
  }
}

function encodeLinearGradient({ fill, width, height }) {
  const gradHelper = linearGradientHelper(
    width,
    height,
    fill.startX,
    fill.startY,
    fill.endX,
    fill.endY
  )
  const colors = fill.colorStops
    .map(point => {
      const color = encodeColor(point.color)
      const stop = gradHelper.mapStop(point.stop)
      return `${color} ${roundFloat(100 * stop)}%`
    })
    .join(', ')
  return `linear-gradient(${roundFloat(
    gradHelper.angle
  )}deg, ${colors}) no-repeat`
}

function placeholderImageURL({ width, height }, devicePixelRatio = 2) {
  const w = Math.round(devicePixelRatio * width)
  const h = Math.round(devicePixelRatio * height)
  return `https://source.unsplash.com/random/${w}x${h}`
}

function getImageFillURL(node) {
  return placeholderImageURL(node.localBounds)
}

function backgroundStyle(node, includeImage = false) {
  if (node.fillEnabled) {
    const { fill } = node
    if (fill instanceof sg.Color) {
      return {
        background: encodeColor(fill)
      }
    } else if (fill instanceof sg.LinearGradient) {
      return {
        background: encodeLinearGradient(node)
      }
    } else if (includeImage && node.fill instanceof sg.ImageFill) {
      const imageURL = getImageFillURL(node)
      return {
        'background-image': `url('${imageURL}')`,
        'background-position': 'center',
        'background-size': 'cover',
        'background-repeat': 'no-repeat'
      }
    }
  }
  return null
}

function hasStroke(node) {
  return (
    node instanceof sg.GraphicNode &&
    node.strokeEnabled &&
    node.stroke !== null &&
    node.strokeWidth > 0
  )
}

function getInnerBorderWidth(node) {
  return hasStroke(node) && node.strokePosition === sg.GraphicNode.INNER_STROKE
    ? node.strokeWidth
    : 0
}

function borderStyle(node) {
  if (hasStroke(node)) {
    const width = encodeLength(node.strokeWidth)
    const lineStyle = node.strokeDashArray.length > 0 ? 'dashed' : 'solid'
    const color = encodeColor(node.stroke)
    if (node.strokePosition === sg.GraphicNode.INNER_STROKE) {
      return {
        'box-sizing': 'border-box',
        border: `${width} ${lineStyle} ${color}`
      }
    }
    if (
      node.strokePosition === sg.GraphicNode.OUTER_STROKE &&
      !node.hasRoundedCorners
    ) {
      return {
        outline: `${color} ${lineStyle} ${width} `
      }
    }
  }
  return null
}

function borderRadiusStyle({ hasRoundedCorners, effectiveCornerRadii }) {
  if (hasRoundedCorners) {
    const c = effectiveCornerRadii
    const v = []
    if (
      nearlyEq(c.topLeft, c.bottomRight) &&
      nearlyEq(c.topRight, c.bottomLeft)
    ) {
      if (nearlyEq(c.topLeft, c.topRight)) {
        v.push(c.topLeft)
      } else {
        v.push(c.topLeft, c.topRight)
      }
    } else {
      v.push(c.topLeft, c.topRight, c.bottomRight, c.bottomLeft)
    }
    return {
      'border-radius': v.map(e => encodeLength(e)).join(' ')
    }
  }
  return null
}

function shadowStyle(node) {
  const shadow = node.shadow
  if (shadow && shadow.visible) {
    const v = [
      encodeLength(shadow.x),
      encodeLength(shadow.y),
      encodeLength(shadow.blur),
      encodeColor(shadow.color)
    ].join(' ')
    if (node instanceof sg.Text) {
      return {
        'text-shadow': v
      }
    } else if (node instanceof sg.Rectangle) {
      return {
        'box-shadow': v
      }
    } else {
      return {
        filter: `drop-shadow(${v})`
      }
    }
  }
}

function boxStyle(node, includeImage = false) {
  return {
    ...backgroundStyle(node, includeImage),
    ...borderStyle(node),
    ...borderRadiusStyle(node),
    ...shadowStyle(node)
  }
}

function boxStyleAndImage(node) {
  const style = boxStyle(node, true)
  const key = 'background-image'
  const value = style[key]
  if (value != null) {
    delete style[key]
    return {
      boxStyle: style,
      imageStyle: {
        [key]: value
      }
    }
  }
  return { boxStyle: style }
}

module.exports = {
  opacityStyle,
  getImageFillURL,
  backgroundStyle,
  hasStroke,
  getInnerBorderWidth,
  borderStyle,
  borderRadiusStyle,
  shadowStyle,
  boxStyle,
  boxStyleAndImage
}
