const dft = require('diff-file-tree')
const path = require('path')
const {maybe, tonix} = require('./common')
const pump = require('pump')
const concat = require('concat-stream')

async function diff (archive, other, prefix) {
  var diffStream = await archive.createDiffStream(other, prefix)
  return new Promise((resolve, reject) => {
    pump(diffStream, concat({encoding: 'object'}, resolve), reject)
  })
}

module.exports = {diff}
