const sg = require('scenegraph')
const { createElement } = require('./vnode')
const cssRules = require('./css-rules')
const { encodeLength, encodeColor, encodePercent } = require('./encode-style')
const { opacityStyle, hasStroke } = require('./node-style')
const options = require('./options')

function getRuledLine(node) {
  if (node instanceof sg.Line && hasStroke(node)) {
    if (node.start.y === node.end.y) {
      return {
        isHorizontal: true
      }
    }
    if (node.start.x === node.end.x) {
      return {
        isHorizontal: false
      }
    }
  }

  if (node instanceof sg.Path && hasStroke(node)) {
    const found = node.pathData.match(
      /M\s+(?<x1>\d+(\.\d+)?)\s+(?<y1>\d+(\.\d+)?)\s+L\s+(?<x2>\d+(\.\d+)?)\s+(?<y2>\d+(\.\d+)?)\s*$/
    )
    if (found && found.groups) {
      const { x1, y1, x2, y2 } = found.groups
      if (y1 === y2) {
        return {
          isHorizontal: true
        }
      }
      if (x1 === x2) {
        return {
          isHorizontal: false
        }
      }
    }
  }

  return null
}

function strokeDashStyle(
  { stroke, strokeWidth, strokeDashArray },
  isHorizontal
) {
  const width = encodeLength(strokeWidth)
  const margin = encodeLength(-strokeWidth / 2)
  const dashStyle =
    strokeDashArray.length === 0
      ? {
          background: encodeColor(stroke)
        }
      : (() => {
          const segment = strokeDashArray[0]
          const gap = strokeDashArray.length >= 2 ? strokeDashArray[1] : segment
          const total = segment + gap
          const direction = isHorizontal ? 'to right' : 'to bottom'
          const color = encodeColor(stroke)
          const segmentPercent = encodePercent(segment, total, 2, false)
          const length = encodeLength(total)
          return {
            background: `linear-gradient(${direction}, ${color}, ${color} ${segmentPercent}, transparent ${segmentPercent}, transparent) 0% 0%`,
            'background-size': isHorizontal
              ? `${length} ${width}`
              : `${width} ${length}`
          }
        })()
  return {
    ...(isHorizontal
      ? {
          height: width
        }
      : {
          width: width,
          height: '100%'
        }),
    margin: isHorizontal ? `${margin} 0` : `0 ${margin}`,
    ...dashStyle
  }
}

function transformRuledLine(node) {
  const line = getRuledLine(node)
  if (line === null) {
    return null
  }

  const vnode = createElement('div')
  vnode._prefix = options.get(node)._className || 'rule'
  vnode._contentWidth = line.isHorizontal ? null : 'auto'
  vnode._contentHeight = line.isHorizontal ? 'auto' : null
  cssRules.add(vnode, {
    selector: ':scope::before',
    style: {
      display: 'block',
      content: `''`,
      ...strokeDashStyle(node, line.isHorizontal),
      ...opacityStyle(node)
    }
  })
  return vnode
}

module.exports = transformRuledLine
