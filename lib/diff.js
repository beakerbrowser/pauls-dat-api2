const {massageMetadataOutput} = require('./common')
const pump = require('pump')
const concat = require('concat-stream')

async function diff (archive, other, prefix) {
  var diffStream = await archive.createDiffStream(other, prefix)
  var changes = await new Promise((resolve, reject) => {
    pump(diffStream, concat({encoding: 'object'}, resolve), reject)
  })
  for (let change of changes) {
    if (change.value && change.value.stat) {
      massageMetadataOutput(change.value.stat.metadata)
    }
  }
  return changes
}

module.exports = {diff}
