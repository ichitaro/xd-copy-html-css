const is = require('@sindresorhus/is')

function escapeHTML(unsafe) {
  if (process.env.NODE_ENV !== 'production') {
    is.assert.string(unsafe)
  }

  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

module.exports = escapeHTML
