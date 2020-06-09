const path = require('path')
const pump = require('pump')
const {maybe, toBeakerError, toValidEncoding, encodeMetadata, ensureParentDir} = require('./common')
const {VALID_PATH_REGEX} = require('./const')
const {
  InvalidEncodingError,
  InvalidPathError,
  EntryAlreadyExistsError
} = require('beaker-error-constants')
const {stat} = require('./lookup')
const {readdir} = require('./read')
const {unlink, rmdir} = require('./delete')
const {mount, unmount} = require('./mount')

function writeFile (archive, name, data, opts, cb) {
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }

  return maybe(cb, async function () {
    if (typeof opts === 'string') {
      opts = { encoding: opts }
    }
    opts = opts || {}

    // ensure the target path is valid
    if (name.slice(-1) === '/') {
      throw new InvalidPathError('Files can not have a trailing slash')
    }
    if (!VALID_PATH_REGEX.test(name)) {
      throw new InvalidPathError('Path contains invalid characters')
    }

    // ensure the target location is writable
    var existingEntry
    try { existingEntry = await stat(archive, name) } catch (e) {}
    if (existingEntry && !existingEntry.isFile()) {
      throw new EntryAlreadyExistsError('Cannot overwrite non-files')
    }
    await ensureParentDir(archive, name)

    // copy ctime from the existing entry
    if (existingEntry) {
      opts.ctime = existingEntry.ctime
      if (!opts.metadata) opts.metadata = existingEntry.metadata
    }

    // guess the encoding by the data type
    if (!opts.encoding) {
      opts.encoding = (typeof data === 'string' ? 'utf8' : 'binary')
    }
    opts.encoding = toValidEncoding(opts.encoding)

    if (opts.encoding === 'json') {
      data = JSON.stringify(data, null, 2)
      opts.encoding = 'utf8'
    }

    // validate the encoding
    if (typeof data === 'string' && !opts.encoding) {
      throw new InvalidEncodingError()
    }
    if (typeof data !== 'string' && opts.encoding) {
      throw new InvalidEncodingError()
    }

    // TEMP work around lack of encoding support
    if (typeof data === 'string') {
      data = new Buffer(data, opts.encoding)
    }

    // write
    var writeOpts = {}
    if (opts.ctime || opts.metadata) {
      writeOpts.ctime = opts.ctime
      writeOpts.metadata = opts.metadata
      encodeMetadata(writeOpts.metadata)
    }
    return new Promise((resolve, reject) => {
      archive.writeFile(name, data, writeOpts, err => {
        if (err) reject(toBeakerError(err, 'writeFile'))
        else resolve()
      })
    })
  })
}

function mkdir (archive, name, opts, cb) {
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }

  return maybe(cb, async function () {
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

    return new Promise((resolve, reject) => {
      archive.mkdir(name, err => {
        if (err) reject(toBeakerError(err, 'mkdir'))
        else resolve()
      })
    })
  })
}

function symlink (archive, srcname, dstname, cb) {
  return maybe(cb, async function () {
    // ensure the target paths are valid
    if (!dstname) {
      throw new InvalidPathError('Destination path is required')
    }
    if (!VALID_PATH_REGEX.test(dstname)) {
      throw new InvalidPathError('Destination path contains invalid characters')
    }
    if (!srcname) {
      throw new InvalidPathError('Source path is required')
    }
    if (!VALID_PATH_REGEX.test(srcname)) {
      throw new InvalidPathError('Source path contains invalid characters')
    }

    // ensure the target location is writable
    var existingEntry
    try { existingEntry = await stat(archive, dstname) } catch (e) {}
    if (dstname === '/' || existingEntry) {
      throw new EntryAlreadyExistsError('Cannot overwrite files or folders')
    }
    await ensureParentDir(archive, dstname)

    return new Promise((resolve, reject) => {
      archive.symlink(srcname, dstname, err => {
        if (err) reject(toBeakerError(err, 'symlink'))
        else resolve()
      })
    })
  })
}

function copy (srcArchive, srcName, dstArchive, dstName, cb) {
  return maybe(cb, async function () {
    // ensure the target path is valid
    if (!VALID_PATH_REGEX.test(dstName)) {
      throw new InvalidPathError('Path contains invalid characters')
    }
    await ensureParentDir(dstArchive, dstName)

    // ensure that the target path is not a child of the source
    if (srcArchive.key === dstArchive.key && (dstName === srcName || dstName.startsWith(srcName + '/'))) {
      throw new InvalidPathError('Cannot move or copy a folder to a destination within itself') // that's some existential shit man
    }

    // do copy
    await recurseCopy(srcArchive, srcName, dstArchive, dstName)
  })
}

function rename (srcArchive, srcName, dstArchive, dstName, cb) {
  return maybe(cb, async function () {
    // ensure the target location is writable
    var existingEntry
    try { existingEntry = await stat(dstArchive, dstName) } catch (e) {}
    if (dstName === '/' || (existingEntry && existingEntry.isDirectory())) {
      throw new EntryAlreadyExistsError('Cannot overwrite folders')
    }

    // copy the files over
    await copy(srcArchive, srcName, dstArchive, dstName)

    // delete the old files
    var st = await stat(srcArchive, srcName)
    if (st.mount) {
      await unmount(srcArchive, srcName)
    } else if (st.isDirectory()) {
      await rmdir(srcArchive, srcName, {recursive: true})
    } else {
      await unlink(srcArchive, srcName)
    }
  })
}

function updateMetadata (archive, path, metadata, cb) {
  return maybe(cb, async function () {
    encodeMetadata(metadata)
    return new Promise((resolve, reject) => {
      archive.updateMetadata(path, metadata, err => {
        if (err) reject(toBeakerError(err, 'updateMetadata'))
        else resolve()
      })
    })
  })
}

function deleteMetadata (archive, path, keys, cb) {
  keys = Array.isArray(keys) ? keys : [keys]

  return maybe(cb, async function () {
    return new Promise((resolve, reject) => {
      archive.deleteMetadata(path, keys, err => {
        if (err) reject(toBeakerError(err, 'deleteMetadata'))
        else resolve()
      })
    })
  })
}

function createWriteStream (archive, name, opts, cb) {
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }

  return maybe(cb, async function () {
    opts = opts || {}
    if (opts.metadata) {
      encodeMetadata(opts.metadata)
    }

    // ensure the target path is valid
    if (name.slice(-1) === '/') {
      throw new InvalidPathError('Files can not have a trailing slash')
    }
    if (!VALID_PATH_REGEX.test(name)) {
      throw new InvalidPathError('Path contains invalid characters')
    }

    // ensure the target location is writable
    var existingEntry
    try { existingEntry = await stat(archive, name) } catch (e) {}
    if (existingEntry && !existingEntry.isFile()) {
      throw new EntryAlreadyExistsError('Cannot overwrite non-files')
    }
    await ensureParentDir(archive, name)

    // write
    return archive.createWriteStream(name, opts)
  })
}

module.exports = {writeFile, mkdir, symlink, copy, rename, updateMetadata, deleteMetadata, createWriteStream}

// helpers
// =

function safeStat (archive, path, opts) {
  return stat(archive, path, opts).catch(_ => undefined)
}

async function recurseCopy (srcArchive, srcPath, dstArchive, dstPath) {
  // fetch stats
  var [sourceStat, targetStat] = await Promise.all([
    stat(srcArchive, srcPath, {lstat: true}),
    safeStat(dstArchive, dstPath, {lstat: true})
  ])

  if (targetStat) {
    if (sourceStat.isFile() && !targetStat.isFile()) {
      // never allow this
      throw new EntryAlreadyExistsError(`Cannot copy a file onto a folder (${dstPath})`)
    }
    if (!sourceStat.isFile() && targetStat.isFile()) {
      // never allow this
      throw new EntryAlreadyExistsError(`Cannot copy a folder onto a file (${dstPath})`)
    }
  } else {
    if (!sourceStat.mount && sourceStat.isDirectory()) {
      // make directory
      await mkdir(dstArchive, dstPath)
    }
  }

  if (sourceStat.mount) {
    await mount(dstArchive, dstPath, sourceStat.mount.key)
  } else if (sourceStat.linkname) {
    await symlink(dstArchive, sourceStat.linkname, dstPath)
  } else if (sourceStat.isFile()) {
    encodeMetadata(sourceStat.metadata)
    // copy file
    return new Promise((resolve, reject) => {
      pump(
        srcArchive.createReadStream(srcPath),
        dstArchive.createWriteStream(dstPath, {metadata: sourceStat.metadata}),
        err => {
          if (err) reject(toBeakerError(err, 'createReadStream/createWriteStream'))
          else resolve()
        }
      )
    })
  } else if (sourceStat.isDirectory()) {
    // copy children
    var children = await readdir(srcArchive, srcPath)
    for (var i = 0; i < children.length; i++) {
      await recurseCopy(
        srcArchive,
        path.join(srcPath, children[i]),
        dstArchive,
        path.join(dstPath, children[i])
      )
    }
  } else {
    throw new Error('Unexpectedly encountered an entry which is neither a file or directory at ' + srcPath)
  }
}
