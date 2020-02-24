const callMeMaybe = require('call-me-maybe')
const {NotFoundError, EntryAlreadyExistsError, DestDirectoryNotEmpty} = require('beaker-error-constants')

const HYPERDRIVE_DAEMON_NOTFOUND_ERROR = 2

function toBeakerError (err, info) {
  if (err.details && err.details.indexOf('PathAlreadyExists') !== -1) {
    return new EntryAlreadyExistsError(err.details.slice('PathAlreadyExists: '.length))
  } else if (err.notFound || err.code === 'ENOENT' || err.code === 'ENOTDIR' || err.code === HYPERDRIVE_DAEMON_NOTFOUND_ERROR) {
    return new NotFoundError()
  } else if (err.toString().indexOf('Directory is not empty') !== -1) {
    return new DestDirectoryNotEmpty()
  } else {
    // TODO cover all error types
    console.error(`Pauls-Dat-API: Unhandled error type from ${info}`, err)
    return new Error('Unexpected error: ' + err.toString())
  }
}

// helper to convert an encoding to something acceptable
function toValidEncoding (str) {
  if (!str) return 'utf8'
  if (!['utf8', 'utf-8', 'hex', 'base64'].includes(str)) return undefined
  return str
}

// helper to call promise-generating function
function maybe (cb, p) {
  if (typeof p === 'function') {
    p = p()
  }
  return callMeMaybe(cb, p)
}

function tonix (str) {
  return str.replace(/\\/g, '/')
}

function massageMetadataOutput (metadata) {
  if (metadata) {
    for (let k in metadata) {
      if (!k.startsWith('bin:')) {
        metadata[k] = metadata[k].toString('utf8')
      }
    }
  }
}

function encodeMetadata (metadata) {
  if (!metadata || typeof metadata !== 'object') return
  for (let k in metadata) {
    if (typeof metadata[k] === 'undefined') {
      delete metadata[k]
    } else if (!k.startsWith('bin:') && !Buffer.isBuffer(metadata[k])) {
      metadata[k] = Buffer.from(String(metadata[k]), 'utf8')
    }
  }
}

module.exports = {
  toBeakerError,
  toValidEncoding,
  maybe,
  tonix,
  massageMetadataOutput,
  encodeMetadata
}
