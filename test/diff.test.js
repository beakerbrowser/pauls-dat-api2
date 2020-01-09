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

test('diff', async t => {
  var changes

  const archive = await tutil.createArchive(daemon, [
    'foo.txt',
    { name: 'bar.data', content: Buffer.from([0x00, 0x01]) },
    'subdir/',
    'subdir/foo.txt',
    { name: 'subdir/bar.data', content: Buffer.from([0x00, 0x01]) }
  ])

  changes = await pda.diff(archive)
  t.is(changes.length, 5)
  t.is(changes[0].type, 'put')
  t.is(changes[0].name, 'subdir')
  t.is(typeof changes[0].value.stat, 'object')
  t.is(changes[0].value.stat.mode, 16877)

  changes = await pda.diff(archive, 2)
  t.is(changes.length, 4)
  var oldArchive = await archive.checkout(2)
  var changes2 = await pda.diff(archive, oldArchive)
  t.deepEqual(changes, changes2)
  changes = await pda.diff(archive, 0, 'subdir')
  t.is(changes.length, 3)

  var archive2 = await tutil.createArchive(daemon, ['bar'])
  await pda.mount(archive, '/foo', archive2.key)
  // TODO mounts

  await pda.writeFile(archive, '/meta', '', {metadata: {foo: 'bar'}})
  changes = await pda.diff(archive)
  t.is(changes.find(c => c.name === 'meta').value.stat.metadata.foo, 'bar')
})