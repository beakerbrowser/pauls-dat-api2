const test = require('ava')
const tutil = require('./util')
const pda = require('../index')

var daemon

test.before(async () => {
  daemon = await tutil.createOneDaemon()
})
test.after(async () => {
  await daemon.cleanup()
})

test('unlink', async t => {
  var archive = await tutil.createArchive(daemon, [
    'a',
    'b/',
    'b/a',
    'c/',
    'c/b/',
    'c/b/a'
  ])

  await pda.unlink(archive, '/a')
  await t.throws(pda.stat(archive, '/a'))
  await pda.unlink(archive, 'b/a')
  await t.throws(pda.stat(archive, 'b/a'))
  await pda.unlink(archive, '/c/b/a')
  await t.throws(pda.stat(archive, '/c/b/a'))
  t.deepEqual((await pda.readdir(archive, '/', {recursive: true})).sort().map(tutil.tonix), ['b', 'c', 'c/b'].sort())
})

test('unlink NotFoundError, NotAFileError', async t => {
  var archive = await tutil.createArchive(daemon, [
    'a',
    'b/',
    'b/a',
    'c/',
    'c/b/',
    'c/b/a'
  ])

  const err1 = await t.throws(pda.unlink(archive, '/bar'))
  t.truthy(err1.notFound)
  const err2 = await t.throws(pda.unlink(archive, '/b'))
  t.truthy(err2.notAFile)
})

test('rmdir', async t => {
  var archive = await tutil.createArchive(daemon, [
    'a',
    'b/',
    'b/a/',
    'c/',
    'c/b/'
  ])

  await pda.rmdir(archive, 'b/a')
  await pda.rmdir(archive, 'b')
  await pda.rmdir(archive, 'c/b')
  t.deepEqual((await pda.readdir(archive, '/', {recursive: true})).sort(), ['a', 'c'].sort())
})

test('rmdir recursive', async t => {
  var archive = await tutil.createArchive(daemon, [
    'a',
    'b/',
    'b/a/',
    'b/b',
    'b/c',
    'b/d/',
    'b/d/a',
    'b/d/b',
    'b/d/c/',
    'b/d/c/a',
    'b/d/c/b',
    'b/d/d',
    'c/',
    'c/b/'
  ])

  await pda.rmdir(archive, 'b', {recursive: true})
  t.deepEqual((await pda.readdir(archive, '/', {recursive: true})).map(tutil.tonix).sort(), ['a', 'c', 'c/b'].sort())
})

test('rmdir recursive w/mounts', async t => {
  var archive = await tutil.createArchive(daemon, [
    'foo',
    'sub/'
  ])
  var archive2 = await tutil.createArchive(daemon, [
    'mountfile',
    'mountdir/'
  ])
  await pda.mount(archive, '/sub/mount', archive2.key)

  await pda.rmdir(archive, 'sub', {recursive: true})
  t.deepEqual((await pda.readdir(archive, '/', {recursive: true})).map(tutil.tonix).sort(), ['foo'].sort())
  t.deepEqual((await pda.readdir(archive2, '/', {recursive: true})).map(tutil.tonix).sort(), ['mountfile', 'mountdir'].sort())
})

test('rmdir NotFoundError, NotAFolderError, DestDirectoryNotEmpty', async t => {
  var archive = await tutil.createArchive(daemon, [
    'a',
    'b/',
    'b/a/',
    'c/',
    'c/b/'
  ])

  const err1 = await t.throws(pda.rmdir(archive, '/bar'))
  t.truthy(err1.notFound)
  const err2 = await t.throws(pda.rmdir(archive, '/a'))
  t.truthy(err2.notAFolder)
  const err3 = await t.throws(pda.rmdir(archive, '/b'))
  t.truthy(err3.destDirectoryNotEmpty)
})

test('ArchiveNotWritableError', async t => {
  var archive = await tutil.createArchive(daemon, [], tutil.FAKE_DAT_KEY)

  const err1 = await t.throws(pda.unlink(archive, '/bar'))
  t.truthy(err1.archiveNotWritable)
  const err2 = await t.throws(pda.rmdir(archive, '/bar'))
  t.truthy(err2.archiveNotWritable)
})

test.skip('unlink w/fs', async t => {
  var fs = await tutil.createFs([
    'a',
    'b/',
    'b/a',
    'c/',
    'c/b/',
    'c/b/a'
  ])

  await pda.unlink(fs, '/a')
  await t.throws(pda.stat(fs, '/a'))
  await pda.unlink(fs, 'b/a')
  await t.throws(pda.stat(fs, 'b/a'))
  await pda.unlink(fs, '/c/b/a')
  await t.throws(pda.stat(fs, '/c/b/a'))
  t.deepEqual((await pda.readdir(fs, '/', {recursive: true})).sort().map(tutil.tonix), ['b', 'c', 'c/b'])
})

test.skip('unlink NotFoundError, NotAFileError w/fs', async t => {
  var fs = await tutil.createFs([
    'a',
    'b/',
    'b/a',
    'c/',
    'c/b/',
    'c/b/a'
  ])

  const err1 = await t.throws(pda.unlink(fs, '/bar'))
  t.truthy(err1.notFound)
  const err2 = await t.throws(pda.unlink(fs, '/b'))
  t.truthy(err2.notAFile)
})

test.skip('rmdir w/fs', async t => {
  var fs = await tutil.createFs([
    'a',
    'b/',
    'b/a/',
    'c/',
    'c/b/'
  ])

  await pda.rmdir(fs, 'b/a')
  await pda.rmdir(fs, 'b')
  await pda.rmdir(fs, 'c/b')
  t.deepEqual((await pda.readdir(fs, '/', {recursive: true})).sort(), ['a', 'c'].sort())
})

test.skip('rmdir recursive w/fs', async t => {
  var fs = await tutil.createFs([
    'a',
    'b/',
    'b/a/',
    'b/b',
    'b/c',
    'b/d/',
    'b/d/a',
    'b/d/b',
    'b/d/c/',
    'b/d/c/a',
    'b/d/c/b',
    'b/d/d',
    'c/',
    'c/b/'
  ])

  await pda.rmdir(fs, 'b', {recursive: true})
  t.deepEqual((await pda.readdir(fs, '/', {recursive: true})).map(tutil.tonix).sort(), ['a', 'c', 'c/b'])
})

test.skip('rmdir NotFoundError, NotAFolderError, DestDirectoryNotEmpty w/fs', async t => {
  var fs = await tutil.createFs([
    'a',
    'b/',
    'b/a/',
    'c/',
    'c/b/'
  ])

  const err1 = await t.throws(pda.rmdir(fs, '/bar'))
  t.truthy(err1.notFound)
  const err2 = await t.throws(pda.rmdir(fs, '/a'))
  t.truthy(err2.notAFolder)
  const err3 = await t.throws(pda.rmdir(fs, '/b'))
  t.truthy(err3.destDirectoryNotEmpty)
})
