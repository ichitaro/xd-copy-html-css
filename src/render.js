const { render: renderVnode } = require('./vnode')
const cssRules = require('./css-rules')

function renderComponent(vnode) {
  const css = cssRules.resolve(vnode)
  const style = css ? `<style>${css}</style>` : ''
  const html = renderVnode(vnode)
  return [html, style].filter(x => x).join('\n'.repeat(2))
}

function renderResizableComponent(vnode) {
  const html = renderComponent(vnode)
  const className = (vnode.getAttr('class') || '').split(/\s+/)[0]
  const widthResizable = !vnode._contentWidth
  const heightResizable = !vnode._contentHeight
  const resizeCode = [
    widthResizable ? `event.target.style.width = event.rect.width + 'px'` : '',
    heightResizable
      ? `event.target.style.height = event.rect.height + 'px'`
      : ''
  ]
    .filter(x => x)
    .join('\n')
  const script =
    className && resizeCode
      ? `<!--
A script to check how a component looks when it's resized.
You can remove this script if you wish.
-->
<script src="https://cdn.jsdelivr.net/npm/interactjs@latest"></script>
<script>
interact(document.querySelector('.${className}'))
  .resizable({
    edges: {
      bottom: ${JSON.stringify(heightResizable)},
      right : ${JSON.stringify(widthResizable)}
    }
  })
  .on('resizemove', function(event) { ${resizeCode} })
</script>`
      : null
  return [html, script].filter(x => x).join('\n'.repeat(2))
}

module.exports = renderResizableComponent
