const {maybe, toBeakerError, ensureParentDir} = require('./common')
const {VALID_PATH_REGEX} = require('./const')
const {
  InvalidPathError,
  EntryAlreadyExistsError
} = require('beaker-error-constants')
const {stat} = require('./lookup')

function mount (archive, name, opts, cb) {
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }

  return maybe(cb, async () => {
    if (typeof opts === 'string' || Buffer.isBuffer(opts)) {
      opts = {key: opts}
    }
    if (typeof opts.key === 'string') {
      opts.key = new Buffer(toKey(opts.key), 'hex')
    }

    // ensure the target path is valid
    if (!VALID_PATH_REGEX.test(name)) {
      throw new InvalidPathError('Path contains invalid characters')
    }

    // ensure the target location is writable
    var existingEntry
    try { existingEntry = await stat(archive, name) } catch (e) {}
    if (name === '/' || existingEntry) {
      throw new EntryAlreadyExistsError('Cannot overwrite files or folders')
    }
    await ensureParentDir(archive, name)

    // mount
    return new Promise((resolve, reject) => {
      archive.mount(name, {key: opts.key, version: opts.version}, (err) => {
        if (err) reject(toBeakerError(err, 'mount'))
        else resolve()
      })
    })
  })
}

function unmount (archive, name, cb) {
  return maybe(cb, async () => {
    // ensure the target path is valid
    if (!VALID_PATH_REGEX.test(name)) {
      throw new InvalidPathError('Path contains invalid characters')
    }

    // unmount
    return new Promise((resolve, reject) => {
      archive.unmount(name, (err) => {
        if (err) reject(toBeakerError(err, 'unmount'))
        else resolve()
      })
    })
  })
}

module.exports = {mount, unmount}

function toKey (key) {
  if (typeof key === 'string') {
    let matches = key.match(/[0-9a-f]{64}/i)
    if (matches) return matches[0]
  }
  return key
}