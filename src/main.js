const clipboard = require('clipboard')
const preprocess = require('./preprocess')
const transformEntryNode = require('./transform-entry-node')
const renderHTML = require('./render-html')
const renderPug = require('./render-pug')
const options = require('./options')
const escapeHTML = require('./escape-html')
const dialogs = require('./lib/dialogs')

async function main(render, selection) {
  if (selection.items.length === 0) {
    dialogs.error('Please select one node')
    return
  }

  options.clear()

  const warnings = []
  const vnode = await preprocess(selection.items[0], node => {
    return transformEntryNode(node, { warnings })
  })

  if (warnings.length > 0) {
    const msgs = Array.from(new Set(warnings)).map(
      warn => `• ${escapeHTML(warn)}`
    )
    const { which } = await dialogs.confirm('Warnings', msgs.join('<br><br>'))
    if (which === 0) {
      return
    }
  }

  const output = await render(vnode)

  const { which } = await dialogs.createDialog({
    title: 'HTML Output',
    template: () =>
      `<textarea style='width: 100%;'>${escapeHTML(output)}</textarea>`,
    buttons: [
      { label: 'Cancel', type: 'reset', variant: 'primary' },
      { label: 'Copy', type: 'submit', variant: 'cta' }
    ]
  })

  if (which === 1) {
    clipboard.copyText(output)
  }
}

module.exports = {
  commands: {
    exportHTML: main.bind(null, renderHTML),
    exportPug: main.bind(null, renderPug)
  }
}
