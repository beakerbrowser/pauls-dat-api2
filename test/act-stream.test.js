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

test('watch fs', async t => {
  // HACK
  // 100ms timeouts are needed here because the FS watcher is not as consistent as dat's
  // -prf

  var fs
  var changes
  var stream
  var done

  // all files
  // =

  fs = await tutil.createFs()
  stream = await pda.watch(fs)

  done = new Promise(resolve => {
    changes = ['/a.txt', '/b.txt', '/a.txt', '/a.txt', '/b.txt', '/c.txt']
    let i = 0
    stream.on('data', ([event, args]) => {
      if (process.platform === 'win32' && (++i) % 2 === 0) {
        // HACK win32 emits 2 events for some stupid reason, skip one
        return
      }
      t.deepEqual(event, 'changed')
      t.deepEqual(args.path, changes.shift())
      if (changes.length === 0) resolve()
    })
  })

  await new Promise(r => setTimeout(r, 100))
  await pda.writeFile(fs, '/a.txt', 'one', 'utf8')
  await new Promise(r => setTimeout(r, 100))
  await pda.writeFile(fs, '/b.txt', 'one', 'utf8')
  await new Promise(r => setTimeout(r, 100))
  await pda.writeFile(fs, '/a.txt', 'one', 'utf8')
  await new Promise(r => setTimeout(r, 100))
  await pda.writeFile(fs, '/a.txt', 'two', 'utf8')
  await new Promise(r => setTimeout(r, 100))
  await pda.writeFile(fs, '/b.txt', 'two', 'utf8')
  await new Promise(r => setTimeout(r, 100))
  await pda.writeFile(fs, '/c.txt', 'one', 'utf8')
  await done

  // individual file
  // =

  fs = await tutil.createFs()
  stream = await pda.watch(fs, '/a.txt')

  done = new Promise(resolve => {
    changes = ['/a.txt', '/a.txt', '/a.txt']
    let i = 0
    stream.on('data', ([event, args]) => {
      if (process.platform === 'win32' && (++i) % 2 === 0) {
        // HACK win32 emits 2 events for some stupid reason, skip one
        return
      }
      t.deepEqual(event, 'changed')
      t.deepEqual(args.path, changes.shift())
      if (changes.length === 0) resolve()
    })
  })

  await new Promise(r => setTimeout(r, 100))
  await pda.writeFile(fs, '/a.txt', 'one', 'utf8')
  await new Promise(r => setTimeout(r, 100))
  await pda.writeFile(fs, '/b.txt', 'one', 'utf8')
  await new Promise(r => setTimeout(r, 100))
  await pda.writeFile(fs, '/a.txt', 'one', 'utf8')
  await new Promise(r => setTimeout(r, 100))
  await pda.writeFile(fs, '/a.txt', 'two', 'utf8')
  await new Promise(r => setTimeout(r, 100))
  await pda.writeFile(fs, '/b.txt', 'two', 'utf8')
  await new Promise(r => setTimeout(r, 100))
  await pda.writeFile(fs, '/c.txt', 'one', 'utf8')
  await done

  // subfolder
  // =

  fs = await tutil.createFs()
  stream = await pda.watch(fs, '/foo')

  done = new Promise(resolve => {
    changes = ['/foo', '/foo/a.txt', '/foo/b.txt', '/foo/a.txt', '/foo/a.txt', '/foo/b.txt', '/foo/c.txt']
    let i = 0
    stream.on('data', ([event, args]) => {
      if (process.platform === 'win32' && (++i) % 2 === 0) {
        // HACK win32 emits 2 events for some stupid reason, skip one
        return
      }
      t.deepEqual(event, 'changed')
      t.deepEqual(args.path, changes.shift())
      if (changes.length === 0) resolve()
    })
  })

  await new Promise(r => setTimeout(r, 100))
  await pda.mkdir(fs, '/foo')
  await new Promise(r => setTimeout(r, 100))
  await pda.writeFile(fs, '/ignored.txt', 'one', 'utf8')
  await new Promise(r => setTimeout(r, 100))
  await pda.writeFile(fs, '/foo/a.txt', 'one', 'utf8')
  await new Promise(r => setTimeout(r, 100))
  await pda.writeFile(fs, '/foo/b.txt', 'one', 'utf8')
  await new Promise(r => setTimeout(r, 100))
  await pda.writeFile(fs, '/foo/a.txt', 'one', 'utf8')
  await new Promise(r => setTimeout(r, 100))
  await pda.writeFile(fs, '/foo/a.txt', 'two', 'utf8')
  await new Promise(r => setTimeout(r, 100))
  await pda.writeFile(fs, '/foo/b.txt', 'two', 'utf8')
  await new Promise(r => setTimeout(r, 100))
  await pda.writeFile(fs, '/foo/c.txt', 'one', 'utf8')
  await done

})

test('watch archive', async t => {
  var archive
  var changes
  var stream
  var done

  // all files
  // =

  archive = await tutil.createArchive(daemon)
  stream = pda.watch(archive)

  done = new Promise(resolve => {
    changes = ['/a.txt', '/b.txt', '/a.txt', '/a.txt', '/b.txt', '/c.txt']
    stream.on('data', ([event, args]) => {
      changes.shift()// t.deepEqual(args.path, changes.shift()) TODO
      if (changes.length === 0) {
        stream.destroy()
        resolve()
      }
    })
  })

  await pda.writeFile(archive, '/a.txt', 'one', 'utf8')
  await pda.writeFile(archive, '/b.txt', 'one', 'utf8')
  await pda.writeFile(archive, '/a.txt', 'one', 'utf8')
  await pda.writeFile(archive, '/a.txt', 'two', 'utf8')
  await pda.writeFile(archive, '/b.txt', 'two', 'utf8')
  await pda.writeFile(archive, '/c.txt', 'one', 'utf8')
  await done

  // one file
  // =

  archive = await tutil.createArchive(daemon)
  stream = pda.watch(archive, '/a.txt')

  done = new Promise(resolve => {
    changes = ['/a.txt', '/a.txt', '/a.txt']
    stream.on('data', ([event, args]) => {
      changes.shift()// t.deepEqual(args.path, changes.shift()) TODO
      if (changes.length === 0) {
        stream.destroy()
        resolve()
      }
    })
  })

  await pda.writeFile(archive, '/a.txt', 'one', 'utf8')
  await pda.writeFile(archive, '/b.txt', 'one', 'utf8')
  await pda.writeFile(archive, '/a.txt', 'one', 'utf8')
  await pda.writeFile(archive, '/a.txt', 'two', 'utf8')
  await pda.writeFile(archive, '/b.txt', 'two', 'utf8')
  await pda.writeFile(archive, '/c.txt', 'one', 'utf8')
  await done

  // subfolder
  // =

  archive = await tutil.createArchive(daemon)
  stream = pda.watch(archive, '/foo')

  done = new Promise(resolve => {
    changes = ['/foo', '/foo/a.txt', '/foo/b.txt', '/foo/a.txt', '/foo/a.txt', '/foo/b.txt', '/foo/c.txt']
    stream.on('data', ([event, args]) => {
      changes.shift()// t.deepEqual(args.path, changes.shift()) TODO
      if (changes.length === 0) {
        stream.destroy()
        resolve()
      }
    })
  })

  await pda.mkdir(archive, '/foo')
  await pda.writeFile(archive, '/ignored.txt', 'one', 'utf8')
  await pda.writeFile(archive, '/foo/b.txt', 'one', 'utf8')
  await pda.writeFile(archive, '/foo/a.txt', 'one', 'utf8')
  await pda.writeFile(archive, '/foo/a.txt', 'two', 'utf8')
  await pda.writeFile(archive, '/foo/b.txt', 'two', 'utf8')
  await pda.writeFile(archive, '/foo/c.txt', 'one', 'utf8')
  await pda.writeFile(archive, '/foo/c.txt', 'one', 'utf8')
  await done

  // give the streams 100ms to cleanup, otherwise the grpc library will throw
  await new Promise(r => setTimeout(r, 100))
})

// TODO
test.skip('createNetworkActivityStream', async t => {
  const src = await tutil.createArchive([
    'foo.txt',
    { name: 'bar.data', content: Buffer.from([0x00, 0x01]) },
    'bar.txt'
  ])
  const dst = hyperdrive(tutil.tmpdir(), src.key, {sparse: false})

  var done = new Promise(resolve => {
    var stream = pda.createNetworkActivityStream(dst)
    var gotPeer = false
    var stats = {
      metadata: {
        down: 0,
        synced: false
      },
      content: {
        down: 0,
        synced: false
      }
    }
    stream.on('data', ([event, args]) => {
      if (event === 'network-changed') {
        gotPeer = true
      } else if (event === 'download') {
        stats[args.feed].down++
      } else if (event === 'sync') {
        stats[args.feed].synced = true
      }
      if (gotPeer &&
        stats.metadata.down === 4 && stats.metadata.synced &&
        stats.content.down === 3 && stats.content.synced) {
        resolve()
      }
    })
  })

  const srcRS = src.replicate({live: true})
  const dstRS = dst.replicate({live: true})
  srcRS.pipe(dstRS).pipe(srcRS)

  await done
})
