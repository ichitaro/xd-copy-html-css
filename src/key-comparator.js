function keyComparator(orderedKeys) {
  const toOrder = new Map()
  let n = 1
  for (const key of orderedKeys) {
    toOrder.set(key, n++)
  }
  return (a, b) => {
    const ia = toOrder.get(a) || Number.MAX_VALUE
    const ib = toOrder.get(b) || Number.MAX_VALUE
    return ia - ib
  }
}

module.exports = keyComparator
