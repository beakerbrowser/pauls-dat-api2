const callMeMaybe = require('call-me-maybe')
const {NotFoundError, NotAvailableError, EntryAlreadyExistsError, DestDirectoryNotEmpty, ArchiveNotWritableError} = require('beaker-error-constants')

const HYPERDRIVE_DAEMON_NOTFOUND_ERROR = 2
var onInvalidAuthFunction

function setInvalidAuthHandler (fn) {
  onInvalidAuthFunction = fn
}

function toBeakerError (err, info) {
  if (err.code == 16) {
    if (onInvalidAuthFunction) onInvalidAuthFunction()
    return new Error('The Hypercore daemon has reset due to internal error. Please try again.')
  } else if (err.toString().indexOf('Block not available') !== -1) {
    return new NotAvailableError()
  } else if (err.details && err.details.indexOf('PathAlreadyExists') !== -1) {
    return new EntryAlreadyExistsError(err.details.slice('PathAlreadyExists: '.length))
  } else if (err.details && err.details.indexOf('feed is not writable') !== -1) {
    return new ArchiveNotWritableError()
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
  if (!['utf8', 'utf-8', 'hex', 'base64', 'json'].includes(str)) return undefined
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
        metadata[k] = metadata[k] && metadata[k].toString('utf8')
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

async function ensureParentDir (archive, name) {
  var parts = name.split('/').filter(Boolean)
  for (let i = parts.length - 1; i > 0; i--) {
    let path = '/' + parts.slice(0, i).join('/')
    let st = await new Promise(r => archive.stat(path, (err, res) => r(res)))
    if (st) return
    await archive.mkdir(path)
  }
}

module.exports = {
  setInvalidAuthHandler,
  toBeakerError,
  toValidEncoding,
  maybe,
  tonix,
  massageMetadataOutput,
  encodeMetadata,
  ensureParentDir
}
