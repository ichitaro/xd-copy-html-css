const is = require('@sindresorhus/is')
const hashSum = require('hash-sum')
const beautifyCSS = require('js-beautify').css
const { assertIsStyle, encodeStyle } = require('./encode-style')
const { assertIsElement, traverse } = require('./vnode')

class ElementRules {
  constructor() {
    this.rules = new Map()
  }

  addRule({ selector, style }) {
    if (process.env.NODE_ENV !== 'production') {
      is.assert.string(selector)
      if (selector.match(/^:scope($|[^_a-zA-Z0-9-])/) === null) {
        throw new TypeError(`Invalid selector: ${JSON.stringify(selector)}`)
      }
      if (style && typeof style !== 'function') {
        assertIsStyle(style)
      }
    }

    if (!style) return

    const regSelector = beautifyCSS(selector, {
      space_around_selector_separator: true
    })
    const curStyle = this.rules.has(regSelector)
      ? this.rules.get(regSelector).style
      : {}
    const newStyle =
      typeof style === 'function'
        ? style({ ...curStyle }) || {}
        : Object.assign(curStyle, style)

    for (const key of Object.keys(newStyle)) {
      if (!newStyle[key]) {
        delete newStyle[key]
      }
    }

    if (Object.keys(newStyle).length > 0) {
      this.rules.set(regSelector, {
        selector: regSelector,
        style: newStyle
      })
    } else {
      this.rules.delete(regSelector)
    }

    return this
  }

  addRules(rules) {
    if (process.env.NODE_ENV !== 'production') {
      is.assert.iterable(rules)
    }

    for (const rule of rules) {
      this.addRule(rule)
    }

    return this
  }

  [Symbol.iterator]() {
    return this.rules.values()
  }

  toJSON() {
    return Array.from(this)
  }
}

function add(vnode, rules) {
  if (process.env.NODE_ENV !== 'production') {
    assertIsElement(vnode)
  }

  if (vnode.type !== 'tagged') {
    if (process.env.NODE_ENV !== 'production') {
      console.error(`can't add CSS to the node: ${JSON.stringify(vnode)}`)
    }
    return vnode
  }

  vnode._css = vnode._css || new ElementRules()

  const css = vnode._css
  if (is.iterable(rules)) {
    css.addRules(rules)
  } else {
    css.addRule(rules)
  }

  return vnode
}

function resolve(vnode) {
  const ruleSet = new Set()
  for (const el of traverse(vnode)) {
    if (el.type !== 'tagged') continue

    const css = el._css
    if (!(css instanceof ElementRules)) continue

    const rules = Array.from(css)
    if (rules.length === 0) continue

    const prefix = el._prefix
    const className = prefix
      ? `${prefix}-${hashSum(rules)}`
      : `_${hashSum(rules)}`
    for (const { selector, style } of rules) {
      if (process.env.NODE_ENV !== 'production') {
        is.assert.nonEmptyObject(style)
      }

      const newSelector = selector.replace(/^:scope/, `.${className}`)
      ruleSet.add(`${newSelector} {${encodeStyle(style)}}`)
    }
    el.setAttr(
      'class',
      [
        ...(el.getAttr('class') || '').split(/\s+/).filter(x => x),
        className
      ].join(' ')
    )
  }
  return Array.from(ruleSet.values()).join(' ')
}

module.exports = {
  add,
  resolve
}
