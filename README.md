# pauls-dat-api2

The internal implementation for [Beaker](https://github.com/beakerbrowser/beaker)'s `DatArchive` APIs.
Works with Dat 2.0.

All async methods work with callbacks and promises. If no callback is provided, a promise will be returned.

Any time a hyperdrive `archive` is expected, a [scoped-fs](https://github.com/pfrazee/scoped-fs) instance can be provided, unless otherwise stated.

```js
var hyperdrive = require('hyperdrive')
var ScopedFS = require('scoped-fs')

var archive = hyperdrive('./my-hyperdrive')
var scopedfs = new ScopedFS('./my-scoped-fs')

await pda.readFile(archive, '/hello.txt') // read the published hello.txt
await pda.readFile(scopedfs, '/hello.txt') // read the local hello.txt
```

** NOTE: this library is written natively for node 12 and above. **

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->


- [Lookup](#lookup)
  - [stat(archive, name[, opts, cb])](#statarchive-name-opts-cb)
- [Read](#read)
  - [readFile(archive, name[, opts, cb])](#readfilearchive-name-opts-cb)
  - [readdir(archive, path[, opts, cb])](#readdirarchive-path-opts-cb)
  - [readSize(archive, path[, cb])](#readsizearchive-path-cb)
  - [createReadStream(archive, name[, opts, cb])](#createreadstreamarchive-name-opts-cb)
- [Write](#write)
  - [writeFile(archive, name, data[, opts, cb])](#writefilearchive-name-data-opts-cb)
  - [mkdir(archive, name[, cb])](#mkdirarchive-name-cb)
  - [symlink(archive, target, linkname[, cb])](#symlinkarchive-target-linkname-cb)
  - [copy(srcArchive, srcName, dstArchive, dstName[, cb])](#copysrcarchive-srcname-dstarchive-dstname-cb)
  - [rename(srcArchive, srcName, dstName[, cb])](#renamesrcarchive-srcname-dstname-cb)
  - [updateMetadata(archive, path, metadata[, cb])](#updatemetadataarchive-path-metadata-cb)
  - [deleteMetadata(archive, path, keys[, cb])](#deletemetadataarchive-path-keys-cb)
  - [createWriteStream(archive, name[, cb])](#createwritestreamarchive-name-cb)
- [Delete](#delete)
  - [unlink(archive, name[, cb])](#unlinkarchive-name-cb)
  - [rmdir(archive, name[, opts, cb])](#rmdirarchive-name-opts-cb)
- [Mounts](#mounts)
  - [mount(archive, name, opts[, cb])](#mountarchive-name-opts-cb)
  - [unmount(archive, name[, cb])](#unmountarchive-name-cb)
- [Activity Streams](#activity-streams)
  - [watch(archive[, path])](#watcharchive-path)
  - [createNetworkActivityStream(archive)](#createnetworkactivitystreamarchive)
- [Exporters](#exporters)
  - [exportFilesystemToArchive(opts[, cb])](#exportfilesystemtoarchiveopts-cb)
  - [exportArchiveToFilesystem(opts[, cb])](#exportarchivetofilesystemopts-cb)
  - [exportArchiveToArchive(opts[, cb])](#exportarchivetoarchiveopts-cb)
- [Manifest](#manifest)
  - [readManifest(archive[, cb])](#readmanifestarchive-cb)
  - [writeManifest(archive, manifest[, cb])](#writemanifestarchive-manifest-cb)
  - [updateManifest(archive, manifest[, cb])](#updatemanifestarchive-manifest-cb)
  - [generateManifest(opts)](#generatemanifestopts)
- [Diff](#diff)
  - [diff(archive, other[, prefix])](#diffarchive-other-prefix)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

```js
const pda = require('pauls-dat-api')
```

## Lookup

### stat(archive, name[, opts, cb])

 - `archive` Hyperdrive archive (object).
 - `name` Entry name (string).
 - `opts.lstat` Get symlink information if target is a symlink (boolean).
 - Returns a Hyperdrive Stat entry (object).
 - Throws NotFoundError

```js
// by name:
var st = await pda.stat(archive, '/index.json')
st.isDirectory()
st.isFile()
console.log(st) /* =>
Stat {
  dev: 0,
  nlink: 1,
  rdev: 0,
  blksize: 0,
  ino: 0,
  mode: 16877,
  uid: 0,
  gid: 0,
  size: 0,
  offset: 0,
  blocks: 0,
  atime: 2017-04-10T18:59:00.147Z,
  mtime: 2017-04-10T18:59:00.147Z,
  ctime: 2017-04-10T18:59:00.147Z,
  linkname: undefined } */
```

## Read

### readFile(archive, name[, opts, cb])

 - `archive` Hyperdrive archive (object).
 - `name` Entry path (string).
 - `opts`. Options (object|string). If a string, will act as `opts.encoding`.
 - `opts.encoding` Desired output encoding (string). May be 'binary', 'utf8', 'hex', 'base64', or 'json'. Default 'utf8'.
 - Returns the content of the file in the requested encoding.
 - Throws NotFoundError.

```js
var manifestStr = await pda.readFile(archive, '/index.json')
var manifestObj = await pda.readFile(archive, '/index.json', 'json')
var imageBase64 = await pda.readFile(archive, '/favicon.png', 'base64')
```

### readdir(archive, path[, opts, cb])

 - `archive` Hyperdrive archive (object).
 - `path` Target directory path (string).
 - `opts.recursive` Read all subfolders and their files as well if true. Note: does not recurse into mounts.
 - `opts.includeStats` Output an object which includes the file name, stats object, and parent mount information.
 - Returns an array of file and folder names.

```js
var listing = await pda.readdir(archive, '/assets')
console.log(listing) // => ['profile.png', 'styles.css']

var listing = await pda.readdir(archive, '/', { recursive: true })
console.log(listing) /* => [
  'index.html',
  'assets',
  'assets/profile.png',
  'assets/styles.css'
]*/

var listing = await pda.readdir(archive, '/', { includeStats: true })
console.log(listing) /* => [
  {
    name: 'profile.png',
    stats: { ... },
    mount: { ... }
  },
  ...
]*/
```

### readSize(archive, path[, cb])

 - `archive` Hyperdrive archive (object).
 - `path` Target directory path (string).
 - Returns a number (size in bytes).

This method will recurse on folders.

```js
var size = await pda.readSize(archive, '/assets')
console.log(size) // => 123
```

### createReadStream(archive, name[, opts, cb])

 - `archive` Hyperdrive archive (object).
 - `name` Entry path (string).
 - `opts`. Options (object|string). If a string, will act as `opts.encoding`.
 - `opts.start` Starting offset (number). Default 0.
 - `opts.end`. Ending offset inclusive (number). Default undefined.
 - `opts.length`. How many bytes to read (number). Default undefined.
 - Returns a readable stream.
 - Throws NotFoundError.

```js
pda.createReadStream(archive, '/favicon.png')
pda.createReadStream(archive, '/favicon.png', {
  start: 1,
  end: 3
})
```


## Write

### writeFile(archive, name, data[, opts, cb])

 - `archive` Hyperdrive archive (object).
 - `name` Entry path (string).
 - `data` Data to write (string|Buffer).
 - `opts`. Options (object|string). If a string, will act as `opts.encoding`.
 - `opts.encoding` Desired file encoding (string). May be 'binary', 'utf8', 'hex', 'base64', or 'json'. Default 'utf8' if `data` is a string, 'binary' if `data` is a Buffer.
 - Throws ArchiveNotWritableError, InvalidPathError, EntryAlreadyExistsError, InvalidEncodingError.

```js
await pda.writeFile(archive, '/hello.txt', 'world', 'utf8')
await pda.writeFile(archive, '/thing.json', {hello: 'world'}, 'json')
await pda.writeFile(archive, '/profile.png', fs.readFileSync('/tmp/dog.png'))
```

### mkdir(archive, name[, cb])

 - `archive` Hyperdrive archive (object).
 - `name` Directory path (string).
 - Throws ArchiveNotWritableError, InvalidPathError, EntryAlreadyExistsError, InvalidEncodingError.

```js
await pda.mkdir(archive, '/stuff')
```

### symlink(archive, target, linkname[, cb])

 - `archive` Hyperdrive archive (object).
 - `target` Path to symlink to (string).
 - `linkname` Path to create the symlink (string).
 - Throws ArchiveNotWritableError, InvalidPathError, EntryAlreadyExistsError, InvalidEncodingError.

```js
await pda.symlink(archive, '/hello.txt', '/goodbye.txt')
```

### copy(srcArchive, srcName, dstArchive, dstName[, cb])

 - `srcArchive` Source Hyperdrive archive (object).
 - `srcName` Path to file or directory to copy (string).
 - `dstArchive` Destination Hyperdrive archive (object).
 - `dstName` Where to copy the file or folder to (string).
 - Throws ArchiveNotWritableError, InvalidPathError, EntryAlreadyExistsError, InvalidEncodingError.

```js
// copy file:
await pda.copy(archive, '/foo.txt', archive, '/foo.txt.back')
// copy folder:
await pda.copy(archive, '/stuff', otherArchive, '/stuff')
```

### rename(srcArchive, srcName, dstName[, cb])

 - `srcArchive` Source Hyperdrive archive (object).
 - `srcName` Path to file or directory to rename (string).
 - `dstArchive` Destination Hyperdrive archive (object).
 - `dstName` What the file or folder should be named (string).
 - Throws ArchiveNotWritableError, InvalidPathError, EntryAlreadyExistsError, InvalidEncodingError.

This is equivalent to moving a file/folder.

```js
// move file:
await pda.rename(archive, '/foo.txt', archive, '/foo.md')
// move folder:
await pda.rename(archive, '/stuff', otherArchive, '/stuff')
```

### updateMetadata(archive, path, metadata[, cb])

 - `archive` Hyperdrive archive (object).
 - `path` Entry path (string).
 - `metadata` Metadata values to set (object).

Updates the file/folder metadata. Does not overwrite all values; any existing metadata keys which are not specified in the `metadata` param are preserved.

```js
await pda.updateMetadata(archive, '/hello.txt', {foo: 'bar'})
```

The default encoding for metadata attributes is utf8. Attributes which start with `bin:` are encoded in binary.

```js
await pda.updateMetadata(archive, '/hello.txt', {'bin:foo': Buffer.from([1,2,3,4]})
(await pda.stat(archive, '/hello.txt')).metadata['bin:foo'] //=> Buffer([1,2,3,4])
```

### deleteMetadata(archive, path, keys[, cb])

 - `archive` Hyperdrive archive (object).
 - `path` Entry path (string).
 - `keys` Metadata keys to delete (string | string[]).

```js
await pda.deleteMetadata(archive, '/hello.txt', ['foo'])
```

### createWriteStream(archive, name[, cb])

 - `archive` Hyperdrive archive (object).
 - `name` Entry path (string).
 - Throws ArchiveNotWritableError, InvalidPathError, EntryAlreadyExistsError.

```js
await pda.createWriteStream(archive, '/hello.txt')
```

## Delete

### unlink(archive, name[, cb])

 - `archive` Hyperdrive archive (object).
 - `name` Entry path (string).
 - Throws ArchiveNotWritableError, NotFoundError, NotAFileError

```js
await pda.unlink(archive, '/hello.txt')
```

### rmdir(archive, name[, opts, cb])

 - `archive` Hyperdrive archive (object).
 - `name` Entry path (string).
 - `opts.recursive` Delete all subfolders and files if the directory is not empty.
 - Throws ArchiveNotWritableError, NotFoundError, NotAFolderError, DestDirectoryNotEmpty

```js
await pda.rmdir(archive, '/stuff', {recursive: true})
```

## Mounts

### mount(archive, name, opts[, cb])

 - `archive` Hyperdrive archive (object).
 - `name` Entry path (string).
 - `opts`. Options (object|string). If a string or buffer, will act as `opts.key`.
 - `opts.key` Key of archive to mount. May be a hex string or Buffer.
 - Throws ArchiveNotWritableError, InvalidPathError

```js
await pda.mount(archive, '/foo', archive2.key)
```

### unmount(archive, name[, cb])

 - `archive` Hyperdrive archive (object).
 - `name` Entry path (string).
 - Throws ArchiveNotWritableError, InvalidPathError, NotFoundError

```js
await pda.unmount(archive, '/foo')
```

## Activity Streams

### watch(archive[, path])

 - `archive` Hyperdrive archive (object).
 - `path` Prefix path. If falsy, will watch all files.
 - Returns a Readable stream.

Watches the given path for file events, which it emits as an [emit-stream](https://github.com/substack/emit-stream). Supported events:

 - `['changed',{path}]` - The contents of the file has changed. `path` is the path-string of the file.

```js
var es = pda.watch(archive, 'foo.txt')

es.on('data', ([event, args]) => {
  if (event === 'changed') {
    console.log(args.path, 'has changed')
  }
})

// alternatively, via emit-stream:

var emitStream = require('emit-stream')
var events = emitStream(pda.watch(archive))
events.on('changed', args => {
  console.log(args.path, 'has changed')
})
```

### createNetworkActivityStream(archive)

 - `archive` Hyperdrive archive (object). Can not be a scoped-fs object.
 - Returns a Readable stream.

Watches the archive for network events, which it emits as an [emit-stream](https://github.com/substack/emit-stream). Supported events:

 - `['network-changed',{connections}]` - The number of connections has changed. `connections` is a number.
 - `['download',{feed,block,bytes}]` - A block has been downloaded. `feed` will either be "metadata" or "content". `block` is the index of data downloaded. `bytes` is the number of bytes in the block.
 - `['upload',{feed,block,bytes}]` - A block has been uploaded. `feed` will either be "metadata" or "content". `block` is the index of data downloaded. `bytes` is the number of bytes in the block.
 - `['sync',{feed}]` - All known blocks have been downloaded. `feed` will either be "metadata" or "content".

```js
var es = pda.createNetworkActivityStream(archive)

es.on('data', ([event, args]) => {
  if (event === 'network-changed') {
    console.log('Connected to %d peers', args.connections)
  } else if (event === 'download') {
    console.log('Just downloaded %d bytes (block %d) of the %s feed', args.bytes, args.block, args.feed)
  } else if (event === 'upload') {
    console.log('Just uploaded %d bytes (block %d) of the %s feed', args.bytes, args.block, args.feed)
  } else if (event === 'sync') {
    console.log('Finished downloading', args.feed)
  }
})

// alternatively, via emit-stream:

var emitStream = require('emit-stream')
var events = emitStream(es)
events.on('network-changed', args => {
  console.log('Connected to %d peers', args.connections)
})
events.on('download', args => {
  console.log('Just downloaded %d bytes (block %d) of the %s feed', args.bytes, args.block, args.feed)
})
events.on('upload', args => {
  console.log('Just uploaded %d bytes (block %d) of the %s feed', args.bytes, args.block, args.feed)
})
events.on('sync', args => {
  console.log('Finished downloading', args.feed)
})
```

## Exporters

### exportFilesystemToArchive(opts[, cb])

 - `opts.srcPath` Source path in the filesystem (string). Required.
 - `opts.dstArchive` Destination archive (object). Required.
 - `opts.dstPath` Destination path within the archive. Optional, defaults to '/'.
 - `opts.ignore` Files not to copy (array of strings). Optional. Uses [anymatch](npm.im/anymatch).
 - `opts.inplaceImport` Should import source directory in-place? (boolean). If true and importing a directory, this will cause the directory's content to be copied directy into the `dstPath`. If false, will cause the source-directory to become a child of the `dstPath`.
 - `opts.dryRun` Don't actually make changes, just list what changes will occur. Optional, defaults to `false`.
 - `opts.progress` Function called with the `stats` object on each file updated.
 - Returns stats on the export.

Copies a file-tree into an archive.

```js
var stats = await pda.exportFilesystemToArchive({
  srcPath: '/tmp/mystuff',
  dstArchive: archive,
  inplaceImport: true
})
console.log(stats) /* => {
  addedFiles: ['fuzz.txt', 'foo/bar.txt'],
  updatedFiles: ['something.txt'],
  removedFiles: [],
  addedFolders: ['foo'],
  removedFolders: [],
  skipCount: 3, // files skipped due to the target already existing
  fileCount: 3,
  totalSize: 400 // bytes
}*/
```

### exportArchiveToFilesystem(opts[, cb])

 - `opts.srcArchive` Source archive (object). Required.
 - `opts.dstPath` Destination path in the filesystem (string). Required.
 - `opts.srcPath` Source path within the archive. Optional, defaults to '/'.
 - `opts.ignore` Files not to copy (array of strings). Optional. Uses [anymatch](npm.im/anymatch).
 - `opts.overwriteExisting` Proceed if the destination isn't empty (boolean). Default false.
 - `opts.skipUndownloadedFiles` Ignore files that haven't been downloaded yet (boolean). Default false. If false, will wait for source files to download.
 - Returns stats on the export.

Copies an archive into the filesystem.

NOTE

 - Unlike exportFilesystemToArchive, this will not compare the target for equality before copying. If `overwriteExisting` is true, it will simply copy all files again.

```js
var stats = await pda.exportArchiveToFilesystem({
  srcArchive: archive,
  dstPath: '/tmp/mystuff',
  skipUndownloadedFiles: true
})
console.log(stats) /* => {
  addedFiles: ['fuzz.txt', 'foo/bar.txt'],
  updatedFiles: ['something.txt'],
  fileCount: 3,
  totalSize: 400 // bytes
}*/
```

### exportArchiveToArchive(opts[, cb])

 - `opts.srcArchive` Source archive (object). Required.
 - `opts.dstArchive` Destination archive (object). Required.
 - `opts.srcPath` Source path within the source archive (string). Optional, defaults to '/'.
 - `opts.dstPath` Destination path within the destination archive (string). Optional, defaults to '/'.
 - `opts.ignore` Files not to copy (array of strings). Optional. Uses [anymatch](npm.im/anymatch).
 - `opts.skipUndownloadedFiles` Ignore files that haven't been downloaded yet (boolean). Default false. If false, will wait for source files to download.
 - `opts.dryRun` Don't actually make changes, just list what changes will occur. Optional, defaults to `false`.

Copies an archive into another archive.

NOTE

 - Unlike exportFilesystemToArchive, this will not compare the target for equality before copying. It copies files indescriminately.

```js
var stats = await pda.exportArchiveToArchive({
  srcArchive: archiveA,
  dstArchive: archiveB,
  skipUndownloadedFiles: true
})
console.log(stats) /* => {
  addedFiles: ['fuzz.txt', 'foo/bar.txt'],
  updatedFiles: ['something.txt'],
  removedFiles: ['hi.png'],
  addedFolders: ['foo']
  removedFolders: [],
  fileCount: 3,
  totalSize: 400 // bytes
}*/
```

## Manifest

### readManifest(archive[, cb])

 - `archive` Hyperdrive archive (object).

A sugar to get the manifest object.

```js
var manifestObj = await pda.readManifest(archive)
```

### writeManifest(archive, manifest[, cb])

 - `archive` Hyperdrive archive (object).
 - `manifest` Manifest values (object).

A sugar to write the manifest object.

```js
await pda.writeManifest(archive, { title: 'My dat!' })
```

### updateManifest(archive, manifest[, cb])

 - `archive` Hyperdrive archive (object).
 - `manifest` Manifest values (object).

A sugar to modify the manifest object.

```js
await pda.writeManifest(archive, { title: 'My dat!', description: 'the desc' })
await pda.writeManifest(archive, { title: 'My new title!' }) // preserves description
```

### generateManifest(opts)

 - `opts` Manifest options (object).

Helper to generate a manifest object. Opts in detail:

```
{
  url: String, the dat's url
  title: String
  description: String
  type: String
  author: String | Object{url: String}
  links: Object
  web_root: String
  fallback_page: String
}
```

See: https://github.com/datprotocol/index.json

## Diff

### diff(archive, other[, prefix])

 - `archive` Archive (object). Required.
 - `other` Other version to diff against (number|object). Required.
 - `prefix` Path prefix to filter down to (string). Optional.
 - Returns diff data.

Get a list of differences between an archive at two points in its history

```js
await pda.diff(archive, 2)
await pda.diff(archive, await archive.checkout(2))
await pda.diff(archive, 2, '/subfolder')
```

Output looks like:

```
[
  {type: 'put', name: 'hello.txt', value: {stat: {...}}},
  {type: 'mount', name: 'mounted-folder', value: {mount: {...}}},
  {type: 'del', name: 'hello.txt'}
]
```

## Util

### setInvalidAuthHandler(fn)

 - `fn` Function. Required.

Sets a handler for when the daemon fails authentication. This can occur sometimes because the daemon has reset recently, forcing the auth token to change.