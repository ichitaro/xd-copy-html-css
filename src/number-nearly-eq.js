function numberNearlyEq(num1, num2, threshold = 0.001) {
  return Math.abs(num1 - num2) <= threshold
}

module.exports = numberNearlyEq
