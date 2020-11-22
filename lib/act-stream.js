const emitStream = require('emit-stream')
const EventEmitter = require('events').EventEmitter
const {sep} = require('path')
const {tonix} = require('./common')

function watch (archive, path) {
  // handle by type
  if (!archive.key) {
    return watchFilesystem(archive, path)
  } else {
    return watchArchive(archive, path)
  }
}

function watchFilesystem (fs, path) {
  // create new emitter and stream
  var emitter = new EventEmitter()
  var stream = emitStream(emitter)

  // wire up events
  var stopwatch = fs.watch(sep, onFileChange)
  stream.on('close', () => {
    try { stopwatch() }
    catch (e) { /* ignore - this can happen if fs's path was invalid */ }
  })

  function onFileChange (changedPath) {
    // apply path matching
    changedPath = tonix(changedPath)
    changedPath = temporaryWindowsPathFix(changedPath, fs.base)
    if (path && !changedPath.startsWith(path)) {
      return
    }

    emitter.emit('changed', {path: changedPath})
  }

  return stream
}

function watchArchive (archive, path) {
  // create new emitter and stream
  var emitter = new EventEmitter()
  var stream = emitStream(emitter)

  // wire up events
  var watcher = archive.watch(path || '', onChange)
  var stopwatch = watcher.destroy || watcher
  stream.on('close', () => {
    stopwatch()
  })

  function onChange () {
    emitter.emit('changed', {path: ''}) // TODO
  }

  return stream
}

function createNetworkActivityStream (archive, path) {
  // create new emitter and stream
  var emitter = new EventEmitter()
  var stream = emitStream(emitter)
  stream.on('close', () => {
    // unlisten events
    archive.metadata.removeListener('peer-add', onNetworkChanged)
    archive.metadata.removeListener('peer-remove', onNetworkChanged)
    untrack(archive.metadata, handlers.metadata)
    untrack(archive.content, handlers.content)
  })

  // handlers
  function onNetworkChanged () {
    emitter.emit('network-changed', { connections: archive.metadata.peers.length })
  }
  var handlers = {
    metadata: {
      onDownload (block, data) {
        emitter.emit('download', { feed: 'metadata', block, bytes: data.length })
      },
      onUpload (block, data) {
        emitter.emit('upload', { feed: 'metadata', block, bytes: data.length })
      },
      onSync () {
        emitter.emit('sync', { feed: 'metadata' })
      }
    },
    content: {
      onDownload (block, data) {
        emitter.emit('download', { feed: 'content', block, bytes: data.length })
      },
      onUpload (block, data) {
        emitter.emit('upload', { feed: 'content', block, bytes: data.length })
      },
      onSync () {
        emitter.emit('sync', { feed: 'content' })
      }
    }
  }

  // initialize all trackers
  track(archive.metadata, 'metadata')
  if (archive.content) track(archive.content, 'content')
  else archive.on('content', () => track(archive.content, 'content'))
  archive.metadata.on('peer-add', onNetworkChanged)
  archive.metadata.on('peer-remove', onNetworkChanged)
  function track (feed, name) {
    if (!feed) return
    var h = handlers[name]
    feed.on('download', h.onDownload)
    feed.on('upload', h.onUpload)
    feed.on('sync', h.onSync)
  }
  function untrack (feed, handlers) {
    if (!feed) return
    feed.removeListener('download', handlers.onDownload)
    feed.removeListener('upload', handlers.onUpload)
    feed.removeListener('sync', handlers.onSync)
  }

  return stream
}

// HACK
// workaround for a bug in libuv (https://github.com/nodejs/node/issues/19170)
// paths will sometimes have some of the parent dir in them
// if so, remove that bit
// -prf
function temporaryWindowsPathFix (path, parentPath) {
  if (process.platform === 'win32') {
    let secondSlashIndex = path.indexOf('/', 1)
    let firstSegment = path.slice(1, secondSlashIndex)
    if (parentPath.endsWith(firstSegment)) {
      return path.slice(secondSlashIndex)
    }
  }
  return path
}

module.exports = {watch, createNetworkActivityStream}
