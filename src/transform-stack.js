const { createElement } = require('./vnode')
const cssRules = require('./css-rules')
const {
  roundFloat,
  encodeLength: toPx,
  encodePercent: toPercent,
  encodeMargin
} = require('./encode-style')
const nearlyEq = require('./number-nearly-eq')
const { getPosition, getGoodBounds } = require('./node-position')
const aspectRatioRules = require('./aspect-ratio-rules')
const { opacityStyle } = require('./node-style')
const options = require('./options')

function parsePadding(opts) {
  const arg = opts['padding']
  if (typeof arg === 'number' || arg === false) {
    const n = Math.max(0, +arg)
    return {
      top: n,
      right: n,
      bottom: n,
      left: n
    }
  }
  if (typeof arg === 'string') {
    const words = arg.split(/\s+/).filter(x => x)
    if (words.length === 0) return {}
    const padding =
      words.length === 1
        ? {
            top: words[0],
            right: words[0],
            bottom: words[0],
            left: words[0]
          }
        : words.length === 2
        ? {
            top: words[0],
            right: words[1],
            bottom: words[0],
            left: words[1]
          }
        : words.length === 3
        ? {
            top: words[0],
            right: words[1],
            bottom: words[2],
            left: words[1]
          }
        : {
            top: words[0],
            right: words[1],
            bottom: words[2],
            left: words[3]
          }
    for (const key of Object.keys(padding)) {
      const n = parseFloat(padding[key])
      if (Number.isNaN(n)) {
        delete padding[key]
      } else {
        padding[key] = Math.max(0, n)
      }
    }
    return padding
  }
  return {}
}

function parseAlignMain(arg) {
  if (
    arg === 'normal' ||
    arg === 'n' ||
    arg === 'stretch' ||
    arg === 'fill' ||
    arg === 'f'
  ) {
    return 'normal'
  }
  if (arg === 'start' || arg === 's') {
    return 'start'
  }
  if (arg === 'center' || arg === 'c') {
    return 'center'
  }
  if (arg === 'end' || arg === 'e') {
    return 'end'
  }
  if (arg === 'both' || arg === 'b') {
    return 'both'
  }
  return null
}

function parseAlignCross(arg, normal = 'normal', stretch = 'stretch') {
  if (arg === 'normal' || arg === 'n') {
    return normal
  }
  if (arg === 'stretch' || arg === 'fill' || arg === 'f') {
    return stretch
  }
  if (arg === 'start' || arg === 's') {
    return 'start'
  }
  if (arg === 'center' || arg === 'c') {
    return 'center'
  }
  if (arg === 'end' || arg === 'e') {
    return 'end'
  }
  return null
}

function estimateAlign(start, end, total) {
  const startRate = start / (start + end)
  return {
    isStretch: 2 * (start + end) < total,
    align: startRate < 0.3 ? 'start' : startRate > 0.7 ? 'end' : 'center'
  }
}

function judgeAlignMain(est) {
  return est.isStretch ? null : est.align
}

function judgeAlignCross(est) {
  return est.align === 'center' && est.isStretch ? null : est.align
}

function commonValueForAll(getter, arr) {
  if (arr.length > 0) {
    const v = getter(arr[0])
    if (arr.every(e => getter(e) === v)) {
      return v
    }
  }
  return null
}

function calcMarginByAxis(align, start, end, paddingStart = 0, paddingEnd = 0) {
  let marginStart = start - paddingStart
  marginStart = align === 'end' ? Math.min(marginStart, 0) : marginStart

  let marginEnd = end - paddingEnd
  marginEnd = align === 'start' ? Math.min(marginEnd, 0) : marginEnd

  if (align === 'center') {
    if (marginStart > marginEnd) {
      marginEnd -= marginStart
      marginStart = 0
    } else {
      marginStart -= marginEnd
      marginEnd = 0
    }
  }

  return [marginStart, marginEnd]
}

const positionAbsolute = (() => {
  const parseAlignValue = value => {
    return parseAlignCross(value, 'stretch')
  }

  const parseAlign = arg => {
    if (typeof arg === 'string') {
      const words = arg.split(/\s+/).filter(x => x)
      if (words.length === 1) {
        const value = parseAlignValue(words[0])
        return { v: value, h: value }
      }
      if (words.length >= 2) {
        return { v: parseAlignValue(words[0]), h: parseAlignValue(words[1]) }
      }
    }
    return { v: null, h: null }
  }

  const getAlign = (userAlign, start, end, total) => {
    const align =
      userAlign ||
      judgeAlignCross(estimateAlign(start, end, total)) ||
      'stretch'
    if (align === 'start' && end >= total) {
      return {
        align: 'end',
        outside: true
      }
    }
    if (align === 'end' && start >= total) {
      return {
        align: 'start',
        outside: true
      }
    }
    return {
      align,
      outside: false
    }
  }

  const getPositionByAxis = (
    start,
    size,
    end,
    pos,
    contentSize,
    align,
    outside
  ) => {
    const style = {
      [start]: align !== 'end' ? '0' : null,
      [end]: align !== 'start' ? '0' : null
    }
    const [marginStart, marginEnd] = calcMarginByAxis(
      align,
      pos[start],
      pos[end]
    )
    const margin = {
      [start]: marginStart,
      [end]: marginEnd
    }

    if (outside) {
      if (align === 'start') {
        style[start] = '100%'
        margin[start] -= pos.container[size]
        margin[end] = 0
      } else {
        style[end] = '100%'
        margin[end] -= pos.container[size]
        margin[start] = 0
      }
    }

    if (align !== 'center') {
      const newStyle = { ...style }
      if (align === 'stretch') {
        newStyle[size] = null
      } else if (contentSize !== 'auto' || outside) {
        newStyle[size] = toPx(pos[size])
      }
      return {
        style,
        margin,
        optimized: {
          style: newStyle,
          margin: { ...margin }
        }
      }
    }

    if (contentSize !== 'auto') {
      return {
        style,
        margin,
        optimized: {
          style: {
            [size]: toPx(pos[size]),
            [start]: toPx(margin[start]),
            [end]: toPx(margin[end])
          },
          margin: {
            [start]: 'auto',
            [end]: 'auto'
          }
        }
      }
    }

    return { style, margin }
  }

  const toFlexAlign = {
    center: 'center',
    end: 'flex-end'
  }

  return function (vnode) {
    const origPos = getPosition(vnode._node)
    const pos = vnode._position || origPos

    const userAlign = parseAlign(options.get(vnode._node).absolute)
    const { align: alignV, outside: outsideV } = getAlign(
      userAlign.v,
      origPos.top,
      origPos.bottom,
      origPos.container.height
    )
    const { align: alignH, outside: outsideH } = getAlign(
      userAlign.h,
      origPos.left,
      origPos.right,
      origPos.container.width
    )

    const v = getPositionByAxis(
      'top',
      'height',
      'bottom',
      pos,
      vnode._contentHeight,
      alignV,
      outsideV
    )
    const h = getPositionByAxis(
      'left',
      'width',
      'right',
      pos,
      vnode._contentWidth,
      alignH,
      outsideH
    )

    if (
      v.optimized &&
      h.optimized &&
      (!vnode._breakWord ||
        h.optimized.style.width != null ||
        alignH === 'stretch')
    ) {
      cssRules.add(vnode, {
        selector: ':scope',
        style: {
          ...v.optimized.style,
          ...h.optimized.style,
          margin: encodeMargin({
            ...v.optimized.margin,
            ...h.optimized.margin
          }),
          position: 'absolute'
        }
      })
      return vnode
    }

    const wrapper = createElement('div', {}, [vnode])
    const childName = options.get(vnode._node)._className
    wrapper._prefix = childName
      ? `${childName}-absolute`
      : vnode._prefix.replace(/(-wrapper)?$/, '-absolute')

    const innerStyle = {}
    if (alignH === 'stretch') {
      innerStyle.width = '100%'
    } else if (vnode._contentWidth !== 'auto' || outsideH) {
      innerStyle.width = toPx(pos.width)
    }
    if (alignV === 'stretch') {
      innerStyle.height = '100%'
    } else if (vnode._contentHeight !== 'auto' || outsideV) {
      innerStyle.height = toPx(pos.height)
    }
    if (vnode._breakWord && innerStyle.width == null) {
      innerStyle['min-width'] = '0'
      h.style.left = '0'
      h.style.right = '0'
    }

    cssRules.add(vnode, {
      selector: ':scope',
      style: innerStyle
    })
    cssRules.add(wrapper, {
      selector: ':scope',
      style: {
        ...v.style,
        ...h.style,
        margin: encodeMargin({ ...v.margin, ...h.margin }),
        position: 'absolute',
        display: 'flex',
        'align-items': toFlexAlign[alignV],
        'justify-content': toFlexAlign[alignH]
      }
    })
    return wrapper
  }
})()

const vKeys = {
  start: 'top',
  end: 'bottom',
  size: 'height',
  contentSize: '_contentHeight'
}
const hKeys = {
  start: 'left',
  end: 'right',
  size: 'width',
  contentSize: '_contentWidth'
}

async function transformStack(node, context) {
  const { isStack, isVertical } = context.groupType
  const stackOpts = options.get(node)
  const stackSize = getGoodBounds(node)
  const stack = createElement('div')
  stack._prefix =
    stackOpts._className ||
    (!isStack ? 'group' : isVertical ? 'v-stack' : 'h-stack')
  stack._actualSize = stackSize
  cssRules.add(stack, {
    selector: ':scope',
    style: opacityStyle(node)
  })

  const baseRect = context.mergeBaseRectangle(stack)
  const children = node.children.filter(childNode => {
    return childNode !== baseRect && childNode.visible
  })

  const stackItems = []
  const bgItems = []
  const fgItems = []
  for (const childNode of children) {
    const vnode = await context.transformAnyNode(childNode, context)
    vnode._node = childNode
    if (!isStack || options.get(childNode).absolute) {
      const container = stackItems.length === 0 ? bgItems : fgItems
      container.push(positionAbsolute(vnode))
    } else {
      vnode._position = vnode._position || getPosition(childNode)
      stackItems.push(vnode)
    }
  }

  if (bgItems.length + fgItems.length > 0) {
    cssRules.add(stack, {
      selector: ':scope',
      style: {
        position: 'relative'
      }
    })
  }

  if (stackItems.length === 0) {
    stack.children = stack.children.concat(bgItems, fgItems)
    if (stackOpts['aspect-ratio']) {
      aspectRatioRules.attach(stack, stackSize, aspectRatioRules.AFTER)
    }
    return stack
  }

  const main = isVertical ? vKeys : hKeys
  const cross = isVertical ? hKeys : vKeys
  stackItems.sort((a, b) => {
    return a._position[main.start] - b._position[main.start]
  })
  stack.children = stack.children.concat(bgItems, stackItems, fgItems)

  // Automatically extracts common padding.
  // Get the alignment of each node and guess if it is not specified.
  const alignItemsOpt = parseAlignCross(stackOpts['align-items'])
  const padding = {
    top: Number.POSITIVE_INFINITY,
    right: Number.POSITIVE_INFINITY,
    bottom: Number.POSITIVE_INFINITY,
    left: Number.POSITIVE_INFINITY
  }
  let hasRelSizeMain = false
  let hasRelSizeCross = false
  for (const vnode of stackItems) {
    const pos = vnode._position
    const opts = options.get(vnode._node)

    const alignCross =
      parseAlignCross(opts['align-self']) ||
      alignItemsOpt ||
      judgeAlignCross(
        estimateAlign(
          pos[cross.start],
          pos[cross.end],
          pos.container[cross.size]
        )
      ) ||
      (vnode[cross.contentSize] ? 'normal' : 'stretch')

    vnode._isNormalAlign = alignCross === 'normal'
    vnode._alignCross = vnode._isNormalAlign ? 'start' : alignCross
    vnode._relSizeMain = opts['relative-length']
    vnode._relSizeCross = opts['relative-width']

    padding[main.start] = Math.min(padding[main.start], pos[main.start])
    padding[main.end] = Math.min(padding[main.end], pos[main.end])
    if (
      alignCross === 'normal' ||
      alignCross === 'stretch' ||
      alignCross === 'start'
    ) {
      padding[cross.start] = Math.min(padding[cross.start], pos[cross.start])
    }
    if (
      alignCross === 'normal' ||
      alignCross === 'stretch' ||
      alignCross === 'end'
    ) {
      padding[cross.end] = Math.min(padding[cross.end], pos[cross.end])
    }

    hasRelSizeMain = hasRelSizeMain || !!vnode._relSizeMain
    hasRelSizeCross = hasRelSizeCross || !!vnode._relSizeCross
  }

  for (const key of Object.keys(padding)) {
    if (padding[key] < 0 || padding[key] === Number.POSITIVE_INFINITY)
      padding[key] = 0
  }

  const alignMain =
    parseAlignMain(stackOpts['justify-content']) ||
    judgeAlignMain(
      estimateAlign(
        padding[main.start],
        padding[main.end],
        stackSize[main.size]
      )
    ) ||
    'normal'

  if (alignMain === 'start') {
    padding[main.end] = 0
  } else if (alignMain === 'end') {
    padding[main.start] = 0
  } else if (alignMain === 'center') {
    padding[main.start] = 0
    padding[main.end] = 0
  }

  Object.assign(padding, parsePadding(stackOpts))

  if (hasRelSizeMain) {
    padding[main.start] = 0
    padding[main.end] = 0
  }
  if (hasRelSizeCross) {
    padding[cross.start] = 0
    padding[cross.end] = 0
  }

  // padding is now fixed

  const alignItems =
    (alignItemsOpt === 'normal' ? 'start' : alignItemsOpt) ||
    commonValueForAll(({ _alignCross }) => _alignCross, stackItems) ||
    'stretch'

  cssRules.add(stack, {
    selector: ':scope',
    style: {
      display: 'flex',
      'flex-direction': isVertical ? 'column' : null,
      'justify-content': { center: 'center', end: 'flex-end' }[alignMain],
      'align-items': {
        start: 'flex-start',
        center: 'center',
        end: 'flex-end'
      }[alignItems],
      ...(padding.top > 0 ||
      padding.right > 0 ||
      padding.bottom > 0 ||
      padding.left > 0
        ? {
            'box-sizing': 'border-box',
            padding: encodeMargin(padding)
          }
        : null)
    }
  })

  // Calculate the margin of each node.
  // It also determines whether the size of the container should be fixed.
  ;(() => {
    let hasMaxColumn = false
    let willSpreadH = false
    for (let i = 0, len = stackItems.length; i < len; i++) {
      const vnode = stackItems[i]
      const { _position: pos, _alignCross: alignCross } = vnode
      const [crossMarginStart, crossMarginEnd] = calcMarginByAxis(
        alignCross,
        pos[cross.start],
        pos[cross.end],
        padding[cross.start],
        padding[cross.end]
      )
      vnode._margin = {
        [main.start]: 0,
        [main.end]:
          i + 1 === len
            ? 0
            : stackItems[i + 1]._position[main.start] -
              (pos[main.start] + pos[main.size]),
        [cross.start]: crossMarginStart,
        [cross.end]: crossMarginEnd
      }
      hasMaxColumn =
        hasMaxColumn ||
        (vnode._isNormalAlign &&
          nearlyEq(
            stackSize[cross.size],
            pos[cross.size] +
              crossMarginStart +
              crossMarginEnd +
              padding[cross.start] +
              padding[cross.end]
          ))
      willSpreadH =
        willSpreadH ||
        (isVertical &&
          alignCross === 'stretch' &&
          (vnode._willSpreadH || vnode._node.areaBox))
    }

    if (alignMain === 'both' && stackItems.length >= 2) {
      const maxMarginVNode = stackItems.reduce((acc, vnode) => {
        return vnode._margin[main.end] > acc._margin[main.end] ? vnode : acc
      })
      maxMarginVNode._margin[main.end] = 'auto'
    }

    const first = stackItems[0]
    const last = stackItems[stackItems.length - 1]
    const [marginStart, marginEnd] = calcMarginByAxis(
      alignMain,
      first._position[main.start],
      last._position[main.end],
      padding[main.start],
      padding[main.end]
    )
    first._margin[main.start] = marginStart
    last._margin[main.end] = marginEnd

    stack[main.contentSize] =
      !hasRelSizeMain && alignMain === 'normal' ? 'auto' : null
    stack[cross.contentSize] =
      !hasRelSizeCross && hasMaxColumn && !willSpreadH ? 'auto' : null
    stack._willSpreadH = willSpreadH
  })()

  // Determine the style of each node.
  for (const vnode of stackItems) {
    const {
      _position: pos,
      _alignCross: alignCross,
      _relSizeMain: relSizeMain,
      _relSizeCross: relSizeCross,
      _margin: margin
    } = vnode

    const style = {
      margin: encodeMargin(margin)
    }

    if (bgItems.length > 0) {
      style.position = 'relative'
    }

    if (alignCross !== alignItems) {
      style['align-self'] = {
        stretch: 'stretch',
        start: 'flex-start',
        center: 'center',
        end: 'flex-end'
      }[alignCross]
    }

    if (relSizeMain) {
      style[main.size] = toPercent(pos[main.size], pos.container[main.size])
      if (relSizeMain === 'fr') {
        style.flex = `${roundFloat(pos[main.size])} 1 auto`
      }
    } else if (vnode[main.contentSize] !== 'auto') {
      style[main.size] = toPx(pos[main.size])
      if (vnode[main.contentSize] === 'fixed') {
        style.flex = '0 0 auto'
      }
    }

    if (relSizeCross) {
      style[cross.size] = toPercent(pos[cross.size], pos.container[cross.size])
    } else if (
      alignCross === 'stretch' ||
      vnode[cross.contentSize] === 'auto'
    ) {
      style[cross.size] = null
    } else if (
      vnode[cross.contentSize] === 'fixed' ||
      stack[cross.contentSize]
    ) {
      style[cross.size] = toPx(pos[cross.size])
    } else {
      style[cross.size] = '100%'
      style[`max-${cross.size}`] = toPx(pos[cross.size])
    }

    if (vnode._breakWord && style.width == null) {
      if (isVertical && alignCross !== 'stretch') {
        style['max-width'] = '100%'
      }
      if (!isVertical) {
        style['min-width'] = '0'
      }
    }

    cssRules.add(vnode, {
      selector: `:scope`,
      style: style
    })
  }

  if (stackOpts['aspect-ratio']) {
    const wrapper = createElement('div', {}, [stack])
    wrapper._prefix = `${stack._prefix}-wrapper`
    wrapper._contentWidth = stack._contentWidth
    wrapper._contentHeight = 'auto'
    wrapper._actualSize = stackSize
    cssRules.add(wrapper, [
      {
        selector: `:scope`,
        style: {
          display: 'flex'
        }
      },
      {
        selector: `:scope::before`,
        style: {
          'padding-top': toPercent(stackSize.height, stackSize.width),
          content: `''`
        }
      },
      {
        selector: `:scope > *:first-child`,
        style: {
          width: '100%' // for IE11
        }
      }
    ])
    return wrapper
  }

  return stack
}

module.exports = transformStack
