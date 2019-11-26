const path = require('path')
const pump = require('pump')
const {Transform} = require('stream')
const {maybe, toBeakerError, toValidEncoding} = require('./common')
const {VALID_PATH_REGEX} = require('./const')
const {
  InvalidEncodingError,
  InvalidPathError,
  ArchiveNotWritableError,
  EntryAlreadyExistsError,
  ParentFolderDoesntExistError
} = require('beaker-error-constants')
const {stat} = require('./lookup')
const {readdir} = require('./read')
const {unlink, rmdir} = require('./delete')

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

    // ensure we have the archive's private key
    if (archive.key && !archive.writable) {
      throw new ArchiveNotWritableError()
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

    // copy ctime from the existing entry
    if (existingEntry) {
      opts.ctime = existingEntry.ctime
    }

    // ensure that the parent directory exists
    var parentName = path.dirname(name)
    if (parentName !== '/' && parentName !== '.') {
      var parentEntry
      try { parentEntry = await stat(archive, parentName) } catch (e) {}
      if (!parentEntry || !parentEntry.isDirectory()) {
        throw new ParentFolderDoesntExistError()
      }
    }

    // guess the encoding by the data type
    if (!opts.encoding) {
      opts.encoding = (typeof data === 'string' ? 'utf8' : 'binary')
    }
    opts.encoding = toValidEncoding(opts.encoding)

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
    if (opts.metadata) {
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

function mkdir (archive, name, cb) {
  return maybe(cb, async function () {
    // ensure we have the archive's private key
    if (archive.key && !archive.writable) {
      throw new ArchiveNotWritableError()
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

    // ensure that the parent directory exists
    var parentName = path.dirname(name)
    if (parentName !== '/' && parentName !== '.') {
      var parentEntry
      try { parentEntry = await stat(archive, parentName) } catch (e) {}
      if (!parentEntry || !parentEntry.isDirectory()) {
        throw new ParentFolderDoesntExistError()
      }
    }

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
    // ensure we have the archive's private key
    if (archive.key && !archive.writable) {
      throw new ArchiveNotWritableError()
    }

    // ensure the target paths are valid
    if (!VALID_PATH_REGEX.test(dstname)) {
      throw new InvalidPathError('Destination path contains invalid characters')
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

    // ensure that the parent directory exists
    var parentName = path.dirname(dstname)
    if (parentName !== '/' && parentName !== '.') {
      var parentEntry
      try { parentEntry = await stat(archive, parentName) } catch (e) {}
      if (!parentEntry || !parentEntry.isDirectory()) {
        throw new ParentFolderDoesntExistError()
      }
    }

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
    // ensure we have the archive's private key
    if (dstArchive.key && !dstArchive.writable) {
      throw new ArchiveNotWritableError()
    }

    // ensure the target path is valid
    if (!VALID_PATH_REGEX.test(dstName)) {
      throw new InvalidPathError('Path contains invalid characters')
    }

    // ensure that the target path is not a child of the source
    if (srcArchive.key === dstArchive.key && (dstName === srcName || dstName.startsWith(srcName + '/'))) {
      throw new InvalidPathError('Cannot move or copy a folder to a destination within itself') // that's some existential shit man
    }

    // ensure that the parent directory exists
    var parentName = path.dirname(dstName)
    if (parentName !== '/' && parentName !== '.') {
      var parentEntry
      try { parentEntry = await stat(dstArchive, parentName) } catch (e) {}
      if (!parentEntry || !parentEntry.isDirectory()) {
        throw new ParentFolderDoesntExistError()
      }
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
    if (st.isDirectory()) {
      await rmdir(srcArchive, srcName, {recursive: true})
    } else {
      await unlink(srcArchive, srcName)
    }
  })
}

function updateMetadata (archive, path, metadata, cb) {
  return maybe(cb, async function () {
    if (archive.key && !archive.writable) {
      throw new ArchiveNotWritableError()
    }
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
    if (archive.key && !archive.writable) {
      throw new ArchiveNotWritableError()
    }
    
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

    // ensure we have the archive's private key
    if (archive.key && !archive.writable) {
      throw new ArchiveNotWritableError()
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

    // ensure that the parent directory exists
    var parentName = path.dirname(name)
    if (parentName !== '/' && parentName !== '.') {
      var parentEntry
      try { parentEntry = await stat(archive, parentName) } catch (e) {}
      if (!parentEntry || !parentEntry.isDirectory()) {
        throw new ParentFolderDoesntExistError()
      }
    }

    // write
    return archive.createWriteStream(name, opts)
  })
}

module.exports = {writeFile, mkdir, symlink, copy, rename, updateMetadata, deleteMetadata, createWriteStream}

// helpers
// =

function safeStat (archive, path) {
  return stat(archive, path).catch(_ => undefined)
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

async function recurseCopy (srcArchive, srcPath, dstArchive, dstPath) {
  // fetch stats
  var [sourceStat, targetStat] = await Promise.all([
    stat(srcArchive, srcPath),
    safeStat(dstArchive, dstPath)
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
    if (sourceStat.isDirectory()) {
      // make directory
      await mkdir(dstArchive, dstPath)
    }
  }

  if (sourceStat.isFile()) {
    // copy file
    return new Promise((resolve, reject) => {
      pump(
        srcArchive.createReadStream(srcPath),
        dstArchive.createWriteStream(dstPath),
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
