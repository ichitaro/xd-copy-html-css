const sg = require('scenegraph')
const { selection } = sg
const commands = require('commands')
const { createElement, createTextElement } = require('./vnode')
const cssRules = require('./css-rules')
const { opacityStyle, shadowStyle } = require('./node-style')
const { encodeLength, encodeRatio, encodeColor } = require('./encode-style')
const { getPosition } = require('./node-position')
const options = require('./options')

function styleNameToFontWeight(name) {
  if (name.match(/Thin|Hairline|\bW1\b/i)) return '100'
  if (name.match(/Extra\s*Light|Ultra\s*Light|\bW2\b/i)) return '200'
  if (name.match(/Light|\bW3\b/i)) return '300'
  if (name.match(/Normal|Regular|\bW4\b/i)) return '400'
  if (name.match(/Medium|\bW5\b/i)) return '500'
  if (name.match(/Semi\s*Bold|Demi\s*Bold|\bW6\b/i)) return '600'
  if (name.match(/Extra\s*Bold|Ultra\s*Bold|\bW8\b/i)) return '800'
  if (name.match(/Bold|\bW7\b/i)) return '700'
  if (name.match(/Black|Heavy|\bW9\b/i)) return '900'
  return null
}

function styleNameToFontStyle(name) {
  if (name.match(/Oblique/i)) return 'oblique'
  if (name.match(/Italic/i)) return 'italic'
  return 'normal'
}

function textRangeStyle(range) {
  const props = {}

  props['font-family'] = `'${range.fontFamily}'`

  const fontWeight = styleNameToFontWeight(range.fontStyle)
  if (fontWeight !== null) {
    props['font-weight'] = fontWeight
  }

  props['font-style'] = styleNameToFontStyle(range.fontStyle)

  props['font-size'] = encodeLength(range.fontSize)

  props['color'] = encodeColor(range.fill)

  props['letter-spacing'] = encodeLength(range.charSpacing / 1000, 'em', 3)

  const decorations = [
    range.underline && 'underline',
    range.strikethrough && 'line-through'
  ]
    .filter(x => x)
    .join(' ')
  props['text-decoration'] = decorations || 'none'

  const textTransform = {
    none: 'none',
    uppercase: 'uppercase',
    lowercase: 'lowercase',
    titlecase: 'capitalize'
  }[range.textTransform]
  props['text-transform'] = textTransform

  const verticalAlign = {
    none: 'baseline',
    superscript: 'super',
    subscript: 'sub'
  }[range.textScript]
  props['vertical-align'] = verticalAlign
  if (verticalAlign !== 'baseline') {
    props['font-size'] = '0.582em'
  }

  return props
}

function removeInitialValues(style) {
  if (style['font-style'] === 'normal') {
    delete style['font-style']
  }
  if (style['letter-spacing'] === '0') {
    delete style['letter-spacing']
  }
  if (style['text-decoration'] === 'none') {
    delete style['text-decoration']
  }
  if (style['text-transform'] === 'none') {
    delete style['text-transform']
  }
  if (style['vertical-align'] === 'baseline') {
    delete style['vertical-align']
  }
  return style
}

function getCommonStyleByUsageRate(ranges, isCommonKey) {
  const countByValueByKey = new Map()
  let totalChars = 0
  for (const { text, style } of ranges) {
    const numChars = text.length
    totalChars += numChars
    for (const key of Object.keys(style)) {
      if (!countByValueByKey.has(key)) {
        countByValueByKey.set(key, new Map())
      }
      const countByValue = countByValueByKey.get(key)
      const value = style[key]
      countByValue.set(value, (countByValue.get(value) || 0) + numChars)
    }
  }

  const commonStyle = {}
  for (const [key, countByValue] of countByValueByKey.entries()) {
    const pairs = [...countByValue]
    if (pairs.length > 0) {
      const [value, numChars] = pairs.reduce((acc, pair) => {
        return acc[1] > pair[1] ? acc : pair
      })
      if (isCommonKey(key, numChars, totalChars)) {
        commonStyle[key] = value
      }
    }
  }

  return commonStyle
}

function deleteCommonStyle(style, commonStyle) {
  for (const key of Object.keys(style)) {
    if (style[key] === commonStyle[key]) {
      delete style[key]
    }
  }
  return style
}

function getCommonStyleAndParagraphs(textNode) {
  const { styleRanges } = textNode

  const lastRange = styleRanges[styleRanges.length - 1]
  let start = 0
  const ranges = styleRanges.map(range => {
    const style = textRangeStyle(range)
    const end =
      range !== lastRange ? start + range.length : textNode.text.length
    const text = textNode.text.substring(start, end)
    start = end
    return { style, text }
  })

  const paragraphs = getParagraphs(ranges)
  const cleanRanges = [].concat(...paragraphs)

  let isFontSizeCommonToAll = false
  const commonStyle = getCommonStyleByUsageRate(
    cleanRanges,
    (key, numChars, totalChars) => {
      // text-decoration is not an inherited property
      if (key === 'text-decoration') {
        return numChars === totalChars
      }

      if (key === 'font-size' && numChars === totalChars) {
        isFontSizeCommonToAll = true
      }

      return true
    }
  )

  // To prevent unnecessary code generation
  if (commonStyle['text-decoration'] == null) {
    commonStyle['text-decoration'] = 'none'
  }

  /**
   * The individual styles in a paragraph
   * should refer to the same object,
   * as long as their content is the same.
   */
  for (const range of ranges) {
    deleteCommonStyle(range.style, commonStyle)
  }

  // To prevent unnecessary code generation
  removeInitialValues(commonStyle)

  return {
    commonStyle,
    paragraphs,
    commonFontSize: parseFloat(commonStyle['font-size']),
    isFontSizeCommonToAll
  }
}

function getParagraphs(ranges) {
  return ranges.reduce(
    (acc, range) => {
      const [firstText, ...restTexts] = range.text.split(/\r\n?|\n/)
      if (firstText !== '') {
        acc[acc.length - 1].push({ ...range, text: firstText })
      }
      for (const text of restTexts) {
        acc.push(
          text !== ''
            ? [
                {
                  ...range,
                  text
                }
              ]
            : []
        )
      }
      return acc
    },
    [[]]
  )
}

function createInnerVNodes(
  paragraphs,
  wrapParagraph,
  { span: prefixSpan, p: prefixP }
) {
  const vnodes = []
  const lastIndex = paragraphs.length - 1

  let prevRange = null
  paragraphs.forEach((ranges, i) => {
    const container = wrapParagraph ? [] : vnodes
    for (const { text, style } of ranges) {
      const textVNode = createTextElement(text)
      if (Object.keys(style).length > 0) {
        if (!wrapParagraph && prevRange !== null && prevRange.style === style) {
          prevRange.span.children.push(textVNode)
        } else {
          const span = createElement('span', {}, [textVNode])
          span._prefix = prefixSpan
          cssRules.add(span, {
            selector: ':scope',
            style
          })
          container.push(span)
          prevRange = { span, style }
        }
      } else {
        container.push(textVNode)
        prevRange = null
      }
    }
    if (wrapParagraph) {
      const p = createElement('p', {}, container)
      p._prefix = prefixP
      vnodes.push(p)
    } else if (i !== lastIndex) {
      const br = createElement('br')
      const nextRange = paragraphs[i + 1][0]
      if (
        prevRange !== null &&
        nextRange &&
        nextRange.style === prevRange.style
      ) {
        prevRange.span.children.push(br)
      } else {
        container.push(br)
      }
    }
  })

  return vnodes
}

function cancelTextSpace(position, textSpace) {
  const halfSpace = textSpace / 2
  position.top -= halfSpace
  position.height += textSpace
  position.bottom -= halfSpace
  return position
}

function transformText(node) {
  if (!(node instanceof sg.Text)) {
    return null
  }

  const vnode = createElement('div')
  vnode._prefix = options.get(node)._className || 'text'
  vnode._breakWord = options.get(node)['break-word']
  vnode._contentWidth = node.areaBox == null ? 'auto' : null
  vnode._contentHeight = 'auto'

  const {
    commonStyle,
    paragraphs,
    commonFontSize,
    isFontSizeCommonToAll: useRelativeLength
  } = getCommonStyleAndParagraphs(node)

  const wrapParagraph = node.paragraphSpacing > 0

  vnode.children = createInnerVNodes(paragraphs, wrapParagraph, {
    span: `${vnode._prefix}-span`,
    p: `${vnode._prefix}-p`
  })

  // Text node specific styles
  if (node.lineSpacing > 0) {
    commonStyle['line-height'] = useRelativeLength
      ? encodeRatio(node.lineSpacing, commonFontSize)
      : encodeLength(node.lineSpacing)
  }
  if (node.textAlign !== 'left') {
    const textAlign = {
      center: 'center',
      right: 'right'
    }[node.textAlign]
    if (textAlign != null) {
      commonStyle['text-align'] = textAlign
    }
  }
  if (vnode._breakWord) {
    commonStyle['word-wrap'] = 'break-word'
  }
  cssRules.add(vnode, {
    selector: ':scope',
    style: {
      ...commonStyle,
      ...shadowStyle(node),
      ...opacityStyle(node)
    }
  })

  // To remove whitespace created by line-height
  if (node.lineSpacing > 0) {
    selection.items = [node]
    commands.duplicate()
    const newNode = selection.items[0]
    newNode.areaBox = null
    const numLines = newNode.text.split(/\r\n?|\n/).length
    newNode.removeFromParent()

    const htmlTextHeight =
      node.lineSpacing * numLines +
      node.paragraphSpacing * (paragraphs.length - 1)
    const textSpace = htmlTextHeight - node.localBounds.height

    vnode._position = cancelTextSpace(getPosition(node), textSpace)
  }

  if (wrapParagraph) {
    const paragraphMargin = useRelativeLength
      ? encodeRatio(node.paragraphSpacing, commonFontSize, 'em')
      : encodeLength(node.paragraphSpacing)
    cssRules.add(vnode, [
      {
        selector: ':scope > p',
        style: {
          margin: `0 0 ${paragraphMargin}`
        }
      },
      {
        selector: ':scope > p:last-child',
        style: {
          margin: '0'
        }
      }
    ])
  }

  return vnode
}

module.exports = transformText
