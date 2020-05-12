const sg = require('scenegraph')
const { selection } = sg
const commands = require('commands')
const { trimText } = require('./trimit')
const options = require('./options')

function traverseTree(callback, node) {
  const children =
    node instanceof sg.Group || node instanceof sg.Artboard
      ? node.children.filter(() => true)
      : []

  const toNode = callback(node)

  for (const child of children) {
    traverseTree(callback, child)
  }

  return toNode || node
}

function breakTexts(node) {
  return traverseTree(el => {
    el.locked = false

    if (el instanceof sg.Text) {
      selection.items = el
      commands.convertToPath()
      return selection.items[0]
    }
  }, node)
}

function destructivePreparations(node) {
  return traverseTree(el => {
    el.locked = false

    const arg = options.get(el)['svg']
    if (arg === 'break-text' || arg === 'break') {
      return breakTexts(el)
    }

    if (el instanceof sg.Text) {
      if (el.areaBox) {
        trimText(el)
      }
    }
  }, node)
}

async function runInDuplicatedNode(node, callback) {
  const origSelection = selection.items
  selection.items = [node]
  commands.duplicate()
  const newNode = destructivePreparations(selection.items[0])
  const result = await callback(newNode)
  newNode.removeFromParent()
  selection.items = origSelection
  return result
}

module.exports = runInDuplicatedNode
