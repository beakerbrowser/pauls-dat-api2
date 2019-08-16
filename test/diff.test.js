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

test('diff against empty', async t => {
  var changes

  const srcArchive = await tutil.createArchive(daemon, [
    'foo.txt',
    { name: 'bar.data', content: Buffer.from([0x00, 0x01]) },
    'subdir/',
    'subdir/foo.txt',
    { name: 'subdir/bar.data', content: Buffer.from([0x00, 0x01]) }
  ])
  const dstArchive = await tutil.createArchive(daemon)

  // diff root against empty root, shallow=false, filter=none, ops=all
  // =

  changes = await pda.diff(srcArchive, '/', dstArchive, '/')
  t.deepEqual(changes.map(massageDiffObj).sort(sortFn), [
    { change: 'add', type: 'file', path: '/foo.txt' },
    { change: 'add', type: 'file', path: '/bar.data' },
    { change: 'add', type: 'dir', path: '/subdir' },
    { change: 'add', type: 'file', path: '/subdir/bar.data' },
    { change: 'add', type: 'file', path: '/subdir/foo.txt' }
  ].sort(sortFn))

  // diff root against empty root, shallow=true, filter=none, ops=all
  // =

  changes = await pda.diff(srcArchive, '/', dstArchive, '/', {shallow: true})
  t.deepEqual(changes.map(massageDiffObj).sort(sortFn), [
    { change: 'add', type: 'file', path: '/foo.txt' },
    { change: 'add', type: 'file', path: '/bar.data' },
    { change: 'add', type: 'dir', path: '/subdir' }
  ].sort(sortFn))

  // diff root against empty root, shallow=false, filter=yes, ops=all
  // =

  changes = await pda.diff(srcArchive, '/', dstArchive, '/', {paths: ['/foo.txt', '/subdir']})
  t.deepEqual(changes.map(massageDiffObj).sort(sortFn), [
    { change: 'add', type: 'file', path: '/foo.txt' },
    { change: 'add', type: 'dir', path: '/subdir' },
    { change: 'add', type: 'file', path: '/subdir/bar.data' },
    { change: 'add', type: 'file', path: '/subdir/foo.txt' }
  ].sort(sortFn))

  // diff root against empty root, shallow=false, filter=none, ops=mod
  // =

  changes = await pda.diff(srcArchive, '/', dstArchive, '/', {ops: ['mod']})
  t.deepEqual(changes, [])

  // diff subdir against empty root, shallow=false, filter=none, ops=all
  // =

  changes = await pda.diff(srcArchive, '/subdir', dstArchive, '/')
  t.deepEqual(changes.map(massageDiffObj).sort(sortFn), [
    { change: 'add', type: 'file', path: '/bar.data' },
    { change: 'add', type: 'file', path: '/foo.txt' }
  ].sort(sortFn))

  // diff root against nonexistent empty subdir, shallow=false, filter=none, ops=all
  // =

  var changes = await pda.diff(srcArchive, '/', dstArchive, '/subdir')
  t.deepEqual(changes.map(massageDiffObj).sort(sortFn), [
    { change: 'add', type: 'file', path: '/bar.data' },
    { change: 'add', type: 'dir', path: '/subdir' },
    { change: 'add', type: 'file', path: '/foo.txt' },
    { change: 'add', type: 'file', path: '/subdir/bar.data' },
    { change: 'add', type: 'file', path: '/subdir/foo.txt' }
  ].sort(sortFn))
})

test('diff against populated', async t => {
  var changes

  const srcArchive = await tutil.createArchive(daemon,[
    'foo.txt',
    { name: 'bar.data', content: Buffer.from([0x00, 0x01]) },
    'subdir/',
    'subdir/foo.txt',
    { name: 'subdir/bar.data', content: Buffer.from([0x00, 0x01]) }
  ])

  const dstArchive = await tutil.createArchive(daemon,[
    {name: 'foo.txt', content: 'asdf'},
    'bar.data/',
    'subdir/',
    'subdir/foo.txt/',
    'subdir/bar.data/',
    'subdir/bar.data/hi',
    'otherfile.txt'
  ])

  // diff root against populated root, shallow=false, filter=none, ops=all
  // =

  changes = await pda.diff(srcArchive, '/', dstArchive, '/')
  t.deepEqual(changes.map(massageDiffObj).sort(sortFn), [
    { change: 'del', type: 'file', path: '/otherfile.txt' },
    { change: 'mod', type: 'file', path: '/foo.txt' },
    { change: 'del', type: 'dir', path: '/bar.data' },
    { change: 'add', type: 'file', path: '/bar.data' },
    { change: 'del', type: 'dir', path: '/subdir/foo.txt' },
    { change: 'del', type: 'file', path: '/subdir/bar.data/hi' },
    { change: 'add', type: 'file', path: '/subdir/foo.txt' },
    { change: 'del', type: 'dir', path: '/subdir/bar.data' },
    { change: 'add', type: 'file', path: '/subdir/bar.data' }
  ].sort(sortFn))

  // diff root against populated root, shallow=true, filter=none, ops=all
  // =

  changes = await pda.diff(srcArchive, '/', dstArchive, '/', {shallow: true})
  t.deepEqual(changes.map(massageDiffObj).sort(sortFn), [
    { change: 'del', type: 'file', path: '/otherfile.txt' },
    { change: 'mod', type: 'file', path: '/foo.txt' },
    { change: 'del', type: 'dir', path: '/bar.data' },
    { change: 'add', type: 'file', path: '/bar.data' },
    { change: 'del', type: 'dir', path: '/subdir/foo.txt' },
    { change: 'del', type: 'dir', path: '/subdir/bar.data' },
    { change: 'add', type: 'file', path: '/subdir/bar.data' },
    { change: 'add', type: 'file', path: '/subdir/foo.txt' }
  ].sort(sortFn))

  // diff root against populated root, shallow=false, filter=yes, ops=all
  // =

  changes = await pda.diff(srcArchive, '/', dstArchive, '/', {paths: ['/foo.txt', '/subdir']})
  t.deepEqual(changes.map(massageDiffObj).sort(sortFn), [
    { change: 'mod', type: 'file', path: '/foo.txt' },
    { change: 'del', type: 'dir', path: '/subdir/foo.txt' },
    { change: 'del', type: 'file', path: '/subdir/bar.data/hi' },
    { change: 'add', type: 'file', path: '/subdir/foo.txt' },
    { change: 'del', type: 'dir', path: '/subdir/bar.data' },
    { change: 'add', type: 'file', path: '/subdir/bar.data' }
  ].sort(sortFn))

  // diff root against populated root, shallow=false, filter=none, ops=mod
  // =

  changes = await pda.diff(srcArchive, '/', dstArchive, '/', {ops: ['mod']})
  t.deepEqual(changes.map(massageDiffObj).sort(sortFn), [
    { change: 'mod', type: 'file', path: '/foo.txt' }
  ])

  // diff subdir against populated root, shallow=false, filter=none, ops=all
  // =

  changes = await pda.diff(srcArchive, '/subdir', dstArchive, '/')
  t.deepEqual(changes.map(massageDiffObj).sort(sortFn), [
    { change: 'del', type: 'file', path: '/otherfile.txt' },
    { change: 'mod', type: 'file', path: '/foo.txt' },
    { change: 'del', type: 'dir', path: '/bar.data' },
    { change: 'add', type: 'file', path: '/bar.data' },
    { change: 'del', type: 'dir', path: '/subdir/foo.txt' },
    { change: 'del', type: 'file', path: '/subdir/bar.data/hi' },
    { change: 'del', type: 'dir', path: '/subdir/bar.data' },
    { change: 'del', type: 'dir', path: '/subdir' }
  ].sort(sortFn))

  // diff root against populated subdir, shallow=false, filter=none, ops=all
  // =

  changes = await pda.diff(srcArchive, '/', dstArchive, '/subdir')
  t.deepEqual(changes.map(massageDiffObj).sort(sortFn), [
    { change: 'add', type: 'dir', path: '/subdir' },
    { change: 'add', type: 'file', path: '/subdir/bar.data' },
    { change: 'add', type: 'file', path: '/subdir/foo.txt' },
    { change: 'del', type: 'dir', path: '/foo.txt' },
    { change: 'del', type: 'file', path: '/bar.data/hi' },
    { change: 'add', type: 'file', path: '/foo.txt' },
    { change: 'del', type: 'dir', path: '/bar.data' },
    { change: 'add', type: 'file', path: '/bar.data' }
  ].sort(sortFn))
})

test('diff always ignores dat.json', async t => {
  var changes

  const srcArchive = await tutil.createArchive(daemon,[
    'dat.json',
    'foo.txt',
    { name: 'bar.data', content: Buffer.from([0x00, 0x01]) },
    'subdir/',
    'subdir/foo.txt',
    { name: 'subdir/bar.data', content: Buffer.from([0x00, 0x01]) }
  ])
  const dstArchive = await tutil.createArchive(daemon)

  // no paths filter
  // =

  changes = await pda.diff(srcArchive, '/', dstArchive, '/')
  t.deepEqual(changes.map(massageDiffObj).sort(sortFn), [
    // NOTE: no dat.json
    { change: 'add', type: 'file', path: '/foo.txt' },
    { change: 'add', type: 'file', path: '/bar.data' },
    { change: 'add', type: 'dir', path: '/subdir' },
    { change: 'add', type: 'file', path: '/subdir/bar.data' },
    { change: 'add', type: 'file', path: '/subdir/foo.txt' }
  ].sort(sortFn))

  // with paths filter
  // =

  changes = await pda.diff(srcArchive, '/', dstArchive, '/', {paths: ['/foo.txt', '/subdir']})
  t.deepEqual(changes.map(massageDiffObj).sort(sortFn), [
    // NOTE: no dat.json
    { change: 'add', type: 'file', path: '/foo.txt' },
    { change: 'add', type: 'dir', path: '/subdir' },
    { change: 'add', type: 'file', path: '/subdir/bar.data' },
    { change: 'add', type: 'file', path: '/subdir/foo.txt' }
  ].sort(sortFn))

  // with paths filter that tries to include dat.json
  // =

  changes = await pda.diff(srcArchive, '/', dstArchive, '/', {paths: ['/dat.json', '/foo.txt', '/subdir']})
  t.deepEqual(changes.map(massageDiffObj).sort(sortFn), [
    // NOTE: no dat.json
    { change: 'add', type: 'file', path: '/foo.txt' },
    { change: 'add', type: 'dir', path: '/subdir' },
    { change: 'add', type: 'file', path: '/subdir/bar.data' },
    { change: 'add', type: 'file', path: '/subdir/foo.txt' }
  ].sort(sortFn))
})

test('merge into empty', async t => {
  var changes

  const srcArchive = await tutil.createArchive(daemon,[
    'foo.txt',
    { name: 'bar.data', content: Buffer.from([0x00, 0x01]) },
    'subdir/',
    'subdir/foo.txt',
    { name: 'subdir/bar.data', content: Buffer.from([0x00, 0x01]) }
  ])
  const dstArchive = await tutil.createArchive(daemon)

  changes = await pda.merge(srcArchive, '/', dstArchive, '/')
  t.deepEqual(changes.map(massageDiffObj).sort(sortFn), [
    { change: 'add', type: 'file', path: '/foo.txt' },
    { change: 'add', type: 'file', path: '/bar.data' },
    { change: 'add', type: 'dir', path: '/subdir' },
    { change: 'add', type: 'file', path: '/subdir/bar.data' },
    { change: 'add', type: 'file', path: '/subdir/foo.txt' }
  ].sort(sortFn))

  t.deepEqual((await pda.readdir(dstArchive, '/')).sort(), ['bar.data', 'foo.txt', 'subdir'])
  t.deepEqual((await pda.readdir(dstArchive, '/subdir')).sort(), ['bar.data', 'foo.txt'])
})

test('merge into populated', async t => {
  var changes

  const srcArchive = await tutil.createArchive(daemon,[
    'foo.txt',
    { name: 'bar.data', content: Buffer.from([0x00, 0x01]) },
    'subdir/',
    'subdir/foo.txt',
    { name: 'subdir/bar.data', content: Buffer.from([0x00, 0x01]) }
  ])

  const dstArchive = await tutil.createArchive(daemon,[
    {name: 'foo.txt', content: 'asdf'},
    'bar.data/',
    'subdir/',
    'subdir/foo.txt/',
    'subdir/bar.data/',
    'subdir/bar.data/hi',
    'otherfile.txt'
  ])

  changes = await pda.merge(srcArchive, '/', dstArchive, '/')
  t.deepEqual(changes.map(massageDiffObj).sort(sortFn), [
    { change: 'del', type: 'file', path: '/otherfile.txt' },
    { change: 'mod', type: 'file', path: '/foo.txt' },
    { change: 'del', type: 'dir', path: '/bar.data' },
    { change: 'add', type: 'file', path: '/bar.data' },
    { change: 'del', type: 'dir', path: '/subdir/foo.txt' },
    { change: 'del', type: 'file', path: '/subdir/bar.data/hi' },
    { change: 'add', type: 'file', path: '/subdir/foo.txt' },
    { change: 'del', type: 'dir', path: '/subdir/bar.data' },
    { change: 'add', type: 'file', path: '/subdir/bar.data' }
  ].sort(sortFn))

  t.deepEqual((await pda.readdir(dstArchive, '/')).sort(), ['bar.data', 'foo.txt', 'subdir'])
  t.deepEqual((await pda.readdir(dstArchive, '/subdir')).sort(), ['bar.data', 'foo.txt'])
  t.deepEqual((await pda.stat(dstArchive, '/bar.data')).isFile(), true)
})

test('merge into populated (add only)', async t => {
  var changes

  const srcArchive = await tutil.createArchive(daemon,[
    'foo.txt',
    { name: 'bar.data', content: Buffer.from([0x00, 0x01]) },
    'subdir/',
    'subdir/foo.txt',
    { name: 'subdir/bar.data', content: Buffer.from([0x00, 0x01]) }
  ])

  const dstArchive = await tutil.createArchive(daemon,[
    {name: 'foo.txt', content: 'asdf'},
    'bar.data/',
    'subdir/',
    'subdir/foo.txt/',
    'subdir/bar.data/',
    'subdir/bar.data/hi',
    'otherfile.txt'
  ])

  changes = await pda.merge(srcArchive, '/', dstArchive, '/', {ops: ['add']})
  t.deepEqual(changes.map(massageDiffObj).sort(sortFn), [
    { change: 'add', type: 'file', path: '/bar.data' },
    { change: 'add', type: 'file', path: '/subdir/foo.txt' },
    { change: 'add', type: 'file', path: '/subdir/bar.data' }
  ].sort(sortFn))

  t.deepEqual((await pda.readdir(dstArchive, '/')).sort(), ['bar.data', 'foo.txt', 'otherfile.txt', 'subdir'])
  t.deepEqual((await pda.readdir(dstArchive, '/subdir')).sort(), ['bar.data', 'foo.txt'])
  t.deepEqual((await pda.stat(dstArchive, '/bar.data')).isFile(), true) // add-only still overwrites folders with files
})

function massageDiffObj (d) {
  d.path = tutil.tonix(d.path)
  return d
}

function sortFn (a, b) {
  return a.path.localeCompare(b.path)
}