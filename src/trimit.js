/*
 * Copyright (c) 2018 Peter Flynn
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 */

function trimText(node) {
  // Converge on perfect height by performing the following with progressively smaller increments:
  // - If clippedByArea, expand until not
  // - If not clippedByArea, shrink until is
  const style = node.styleRanges[0]
  let increment = style.lineSpacing || style.fontSize

  if (!node.clippedByArea) {
    increment = -increment
  }

  let height = node.areaBox.height

  for (; Math.abs(increment) >= 1; increment = -Math.trunc(increment / 2)) {
    const origValue = node.clippedByArea

    while (node.clippedByArea === origValue) {
      height += increment
      // console.log(height)
      node.resize(node.areaBox.width, height)
    }
  }

  if (node.clippedByArea) {
    node.resize(node.areaBox.width, height + 1)
  }
}

module.exports = {
  trimText
}
