const is = require('@sindresorhus/is')
const recessOrder = require('stylelint-config-recess-order')
const keyComparator = require('./key-comparator')

function* cssPropsOrder() {
  for (const chunk of recessOrder.rules['order/properties-order']) {
    for (const prop of chunk.properties) {
      yield prop
    }
  }
}

const compareCSSProps = keyComparator(cssPropsOrder())

function encodeStyle(props) {
  if (process.env.NODE_ENV !== 'production') {
    assertIsStyle(props)
  }

  return Object.keys(props)
    .filter(key => props[key])
    .sort(compareCSSProps)
    .map(key => `${key}: ${props[key]};`)
    .join(' ')
}

function assertIsStyle(props) {
  is.assert.object(props)
  for (const key of Object.keys(props)) {
    is.assert.any([is.nullOrUndefined, is.string], props[key])
  }
}

function roundFloat(value, digits = 2) {
  const d = Math.pow(10, digits)
  return Math.round(value * d) / d
}

function encodeLength(n, unit = 'px', digits = 2) {
  const r = roundFloat(n, digits)
  return r === 0 ? '0' : `${r}${unit}`
}

function encodeRatio(n, d, unit = '', digits = 4, useCalc = true) {
  const f = n / d
  const r = roundFloat(f, digits)

  if (useCalc && f !== r && Number.isInteger(n) && Number.isInteger(d)) {
    return `calc(${n}${unit} / ${d})`
  }

  return r === 0 ? '0' : `${r}${unit}`
}

function encodePercent(n, d, digits = 2, useCalc = true) {
  return encodeRatio(100 * n, d, '%', digits, useCalc)
}

function encodeColor(color) {
  if (color.a === 255) {
    return color.toHex()
  } else {
    return `rgba(${color.r},${color.g},${color.b},${roundFloat(color.a / 255)})`
  }
}

function reduceMargin({ top, right, bottom, left }) {
  if (left === right) {
    if (top === bottom) {
      if (left === top) {
        if (left === '0') {
          return []
        }
        return [left]
      } else {
        return [top, left]
      }
    } else {
      return [top, left, bottom]
    }
  } else {
    return [top, right, bottom, left]
  }
}

function encodeMarginValue(x) {
  if (typeof x === 'string') {
    return x
  }
  if (typeof x === 'number') {
    return encodeLength(x)
  }
  throw new TypeError(`Unknown margin value: ${JSON.stringify(x)}`)
}

const marginKeys = ['top', 'right', 'bottom', 'left']
function encodeMargin(margin, toLength = encodeMarginValue) {
  return reduceMargin(
    marginKeys.reduce((acc, key) => {
      const value = margin[key]
      acc[key] = value == null ? '0' : toLength(value)
      return acc
    }, {})
  ).join(' ')
}

module.exports = {
  encodeStyle,
  assertIsStyle,
  roundFloat,
  encodeLength,
  encodeRatio,
  encodePercent,
  encodeColor,
  encodeMargin
}
