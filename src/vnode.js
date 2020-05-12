const is = require('@sindresorhus/is')
const escapeHTML = require('./escape-html')
const { encodeStyle } = require('./encode-style')
const keyComparator = require('./key-comparator')
const compareAttrNames = keyComparator(['id', 'class'])

class AnyElement {
  constructor(type) {
    this.type = type
  }

  render() {}

  *traverse() {
    yield this
  }
}

class TextElement extends AnyElement {
  constructor(content) {
    super('text')
    this.content = content
  }

  render() {
    return escapeHTML(this.content)
  }
}

class RawHTMLElement extends AnyElement {
  constructor(content) {
    super('html')
    this.content = content
  }

  render() {
    return this.content
  }
}

class Element extends AnyElement {
  constructor(tag, attrs, children) {
    if (process.env.NODE_ENV !== 'production') {
      is.assert.nonEmptyString(tag)
      assertChildren(children)
    }

    super('tagged')

    this.tag = tag
    this.attrs = new Map()
    this.children = (children || []).filter(x => x != null && x.content !== '')

    this.setAttrs(attrs)
  }

  setAttrs(attrs) {
    if (process.env.NODE_ENV !== 'production') {
      assertAttrs(attrs)
    }

    if (attrs == null) {
      return this
    }

    if (Array.isArray(attrs)) {
      for (const { name, value } of attrs) {
        this.setAttr(name, value)
      }
      return this
    }
    if (is.map(attrs)) {
      for (const [key, value] of attrs.entries()) {
        this.setAttr(key, value)
      }
      return this
    }
    for (const key of Object.keys(attrs)) {
      this.setAttr(key, attrs[key])
    }
    return this
  }

  setAttr(name, value) {
    if (process.env.NODE_ENV !== 'production') {
      assertAttrName(name)
    }

    this.attrs.set(name, value)
    return this
  }

  getAttr(name) {
    return this.attrs.get(name)
  }

  render() {
    const attrs = this._encodedAttrs

    let innerHTML = ''
    for (const child of this.children) {
      innerHTML += child.render()
    }

    const startTag = this.tag + (attrs ? ' ' + attrs : '')
    if (this.isVoidElement()) {
      return `<${startTag}>`
    }
    return `<${startTag}>${innerHTML}</${this.tag}>`
  }

  get _encodedAttrs() {
    const attrs = this.attrs
    if (process.env.NODE_ENV !== 'production') {
      is.assert.map(attrs)
    }

    let results = ''
    const keys = Array.from(attrs.keys()).sort(compareAttrNames)
    for (const key of keys) {
      const value = attrs.get(key)
      if (value == null) continue
      if (key === 'style' && typeof value !== 'string') {
        // expect single-quoted CSS
        results += ` ${key}="${encodeStyle(value)}"`
        continue
      }
      if (typeof value === 'boolean' && value) {
        results += ` ${key}`
        continue
      }
      if (typeof value === 'string') {
        results += ` ${key}="${escapeHTML(value)}"`
        continue
      }
      if (process.env.NODE_ENV !== 'production') {
        throw new TypeError(
          `Invalid attribute value: ${JSON.stringify({ key, value })}`
        )
      }
    }
    return results.trim()
  }

  isVoidElement() {
    return this.tag.match(
      /^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/
    )
  }

  *traverse() {
    yield this

    for (const child of this.children) {
      for (const el of traverse(child)) {
        yield el
      }
    }
  }

  toJSON() {
    return {
      tag: this.tag,
      attrs: [...this.attrs].reduce(
        (l, [k, v]) => Object.assign(l, { [k]: v }),
        {}
      ),
      children: this.children
    }
  }
}

function assertAttrName(name) {
  is.assert.string(name)
  if (!name.match(/^\S+$/)) {
    throw new TypeError(`Invalid attribute name: ${JSON.stringify(name)}`)
  }
}

function assertAttrs(attrs) {
  is.assert.any([is.nullOrUndefined, is.object], attrs)
  if (Array.isArray(attrs)) {
    for (const attr of attrs) {
      if (!(is.object(attr) && is.string(attr.name) && 'value' in attr)) {
        throw new TypeError(`Invalid attrs: ${JSON.stringify(attrs)}`)
      }
    }
  }
}

function assertIsElement(vnode) {
  if (!(vnode instanceof AnyElement)) {
    throw new TypeError(`Invalid element: ${JSON.stringify(vnode)}`)
  }
}

function assertChildren(children) {
  is.assert.any([is.nullOrUndefined, is.array], children)
  if (children != null) {
    for (const child of children) {
      if (child != null) assertIsElement(child)
    }
  }
}

function createElement(tag, attrs, children) {
  return new Element(tag, attrs, children)
}

function createTextElement(content) {
  if (process.env.NODE_ENV !== 'production') {
    is.assert.string(content)
  }

  return new TextElement(content)
}

function createRawHTMLElement(content) {
  if (process.env.NODE_ENV !== 'production') {
    is.assert.string(content)
  }

  return new RawHTMLElement(content)
}

function render(vnode) {
  if (process.env.NODE_ENV !== 'production') {
    assertIsElement(vnode)
  }

  return vnode.render()
}

function* traverse(vnode) {
  if (process.env.NODE_ENV !== 'production') {
    assertIsElement(vnode)
  }

  yield* vnode.traverse()
}

module.exports = {
  createElement,
  createTextElement,
  createRawHTMLElement,
  assertIsElement,
  render,
  traverse
}
