const parse = require('shell-quote').parse
const parseArgs = require('minimist')

function computedProp(getter) {
  const cache = new Map()
  return {
    clear() {
      cache.clear()
    },
    get(node) {
      const guid = node.guid
      if (cache.has(guid)) {
        return cache.get(guid)
      }
      const value = getter(node)
      cache.set(guid, value)
      return value
    }
  }
}

const options = computedProp(node => {
  if (node.hasDefaultName) return {}

  const commands = node.name

  let argv
  try {
    argv = parse(commands)
  } catch (err) {
    console.error(`${err.message}: ${JSON.stringify(commands)}`)
    return {}
  }

  const opts = parseArgs(argv, {
    alias: {
      type: ['t'],
      padding: ['p'],
      'justify-content': ['jc'],
      'align-items': ['ai'],
      'align-self': ['as'],
      'relative-length': ['rl'],
      'relative-width': ['rw'],
      absolute: ['a'],

      'aspect-ratio': ['aspect', 'r'],
      'break-word': ['bw'],
      inline: ['i'],
      svg: ['s']
    }
  })

  const name = opts._[0]
  if (typeof name === 'string' && /^-?[_a-zA-Z]+[_a-zA-Z0-9-]*$/.test(name)) {
    opts._className = name
  }

  return opts
})

module.exports = options
