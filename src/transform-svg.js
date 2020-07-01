const fs = require('uxp').storage.localFileSystem
const application = require('application')
const SVGO = require('svgo')
const svgToMiniDataURI = require('mini-svg-data-uri')
const { createElement, createRawHTMLElement } = require('./vnode')
const cssRules = require('./css-rules')
const aspectRatioRules = require('./aspect-ratio-rules')
const { opacityStyle } = require('./node-style')
const { encodePercent } = require('./encode-style')
const nearlyEq = require('./number-nearly-eq')
const options = require('./options')

function parseFirstElement(html) {
  const container = document.createElement('div')
  container.innerHTML = html
  const el = container.firstElementChild
  return {
    tag: el.tagName,
    attrs: Array.from(el.attributes).map(({ name, value }) => {
      return { name, value }
    }),
    innerHTML: el.innerHTML
  }
}

function createElementFromHTML(html) {
  const { tag, attrs, innerHTML } = parseFirstElement(html)
  return createElement(tag.toLowerCase(), attrs, [
    createRawHTMLElement(innerHTML)
  ])
}

async function getSVGCode(node) {
  const tmpFolder = await fs.getTemporaryFolder()
  const outputFile = await tmpFolder.createFile('export.svg', {
    overwrite: true
  })
  await application.createRenditions([
    {
      node,
      outputFile,
      type: application.RenditionType.SVG,
      minify: true,
      embedImages: true
    }
  ])
  const svgCode = await outputFile.read()
  return optimize(svgCode)
}

function optimize(svgCode) {
  const svgo = new SVGO({
    plugins: [
      {
        removeViewBox: false
      },
      {
        inlineStyles: {
          onlyMatchedOnce: false
        }
      }
    ]
  })
  return svgo.optimize(svgCode)
}

async function toVNode(node) {
  const { data: svgCode } = await getSVGCode(node)

  const svg = createElementFromHTML(svgCode)
  svg.setAttr('preserveAspectRatio', 'none')

  if (options.get(node)['inline']) {
    return svg
  } else {
    const dataURI = svgToMiniDataURI(svg.render())
    const vnode = createElement('div')
    cssRules.add(vnode, {
      selector: ':scope',
      style: {
        'background-image': `url("${dataURI}")`,
        'background-size': '100% 100%',
        'background-repeat': 'no-repeat'
      }
    })
    return vnode
  }
}

function boundsNearlyEq(a, b) {
  return (
    nearlyEq(a.x, b.x) &&
    nearlyEq(a.y, b.y) &&
    nearlyEq(a.width, b.width) &&
    nearlyEq(a.height, b.height)
  )
}

async function transformSVG(node) {
  const { opacity } = node
  node.opacity = 1
  const svg = await toVNode(node)
  node.opacity = opacity

  svg._prefix = options.get(node)._className || 'svg'
  cssRules.add(svg, {
    selector: ':scope',
    style: opacityStyle(node)
  })

  const { globalDrawBounds: drawBounds, globalBounds: bounds } = node
  const needWrapper = svg.tag === 'svg' || !boundsNearlyEq(drawBounds, bounds)

  const outVNode = needWrapper
    ? (() => {
        cssRules.add(svg, {
          selector: ':scope',
          style: {
            position: 'absolute',
            top: encodePercent(drawBounds.y - bounds.y, bounds.height),
            left: encodePercent(drawBounds.x - bounds.x, bounds.width),
            width: encodePercent(drawBounds.width, bounds.width),
            height: encodePercent(drawBounds.height, bounds.height)
          }
        })

        const wrapper = createElement('div', {}, [svg])
        wrapper._prefix = `${svg._prefix}-wrapper`
        cssRules.add(wrapper, {
          selector: ':scope',
          style: {
            position: 'relative'
          }
        })

        return wrapper
      })()
    : svg

  if (options.get(node)['aspect-ratio']) {
    aspectRatioRules.attach(outVNode, node.localBounds)
  } else {
    outVNode._contentWidth = 'fixed'
    outVNode._contentHeight = 'fixed'
  }

  return outVNode
}

module.exports = transformSVG
