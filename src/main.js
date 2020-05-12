const clipboard = require('clipboard')
const beautify = require('js-beautify').html
const preprocess = require('./preprocess')
const transformEntryNode = require('./transform-entry-node')
const render = require('./render')
const options = require('./options')
const escapeHTML = require('./escape-html')
const dialogs = require('./lib/dialogs')

async function exportHTML(selection) {
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

  const html = render(vnode)
  const prettyHTML = beautify(html, {
    indent_size: 2,
    space_around_selector_separator: true
  })

  const { which } = await dialogs.createDialog({
    title: 'HTML Output',
    template: () =>
      `<textarea style='width: 100%;'>${escapeHTML(prettyHTML)}</textarea>`,
    buttons: [
      { label: 'Cancel', type: 'reset', variant: 'primary' },
      { label: 'Copy', type: 'submit', variant: 'cta' }
    ]
  })

  if (which === 1) {
    clipboard.copyText(prettyHTML)
  }
}

module.exports = {
  commands: {
    exportHTML
  }
}
