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

test('read/write/update manifest', async t => {
  var archive = await tutil.createArchive(daemon, [])

  await pda.writeManifest(archive, {
    url: `dat://${tutil.FAKE_DAT_KEY}`,
    title: 'My Dat',
    description: 'This dat has a manifest!',
    type: 'foo bar',
    links: {repository: 'https://github.com/pfrazee/pauls-dat-api.git'},
    author: 'dat://ffffffffffffffffffffffffffffffff'
  })

  t.deepEqual(await pda.readManifest(archive), {
    title: 'My Dat',
    description: 'This dat has a manifest!',
    type: ['foo', 'bar'],
    links: {repository: [{href: 'https://github.com/pfrazee/pauls-dat-api.git'}]},
    url: `dat://${tutil.FAKE_DAT_KEY}`,
    author: 'dat://ffffffffffffffffffffffffffffffff'
  })

  await pda.updateManifest(archive, {
    title: 'My Dat!!',
    type: 'foo'
  })

  t.deepEqual(await pda.readManifest(archive), {
    title: 'My Dat!!',
    description: 'This dat has a manifest!',
    type: ['foo'],
    links: {repository: [{href: 'https://github.com/pfrazee/pauls-dat-api.git'}]},
    url: `dat://${tutil.FAKE_DAT_KEY}`,
    author: 'dat://ffffffffffffffffffffffffffffffff'
  })

  await pda.updateManifest(archive, {
    author: {url: 'dat://foo.com'}
  })

  t.deepEqual(await pda.readManifest(archive), {
    title: 'My Dat!!',
    description: 'This dat has a manifest!',
    type: ['foo'],
    links: {repository: [{href: 'https://github.com/pfrazee/pauls-dat-api.git'}]},
    url: `dat://${tutil.FAKE_DAT_KEY}`,
    author: 'dat://foo.com'
  })

  // should ignore bad well-known values
  // but leave others alone
  await pda.updateManifest(archive, {
    author: true,
    foobar: true
  })

  t.deepEqual(await pda.readManifest(archive), {
    title: 'My Dat!!',
    description: 'This dat has a manifest!',
    type: ['foo'],
    links: {repository: [{href: 'https://github.com/pfrazee/pauls-dat-api.git'}]},
    url: `dat://${tutil.FAKE_DAT_KEY}`,
    author: 'dat://foo.com',
    foobar: true
  })
})

