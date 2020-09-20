const ScopedFS = require('scoped-fs')
const tmp = require('tmp-promise')
const dht = require('@hyperswarm/dht')
const HyperdriveClient = require('hyperdrive-daemon-client')
const HyperdriveDaemon = require('hyperdrive-daemon')

const BASE_PORT = 4101
const BOOTSTRAP_PORT = 3100
const BOOTSTRAP_URL = `localhost:${BOOTSTRAP_PORT}`

const FAKE_DAT_KEY = new Buffer('f'.repeat(64), 'hex')

async function createDaemon (numServers) {
  const cleanups = []
  const clients = []

  const bootstrapper = dht({
    bootstrap: false
  })
  bootstrapper.listen(BOOTSTRAP_PORT)
  await new Promise(resolve => {
    return bootstrapper.once('listening', resolve)
  })

  for (let i = 0; i < numServers; i++) {
    const { client, cleanup } = await createDaemonInstance(i, BASE_PORT + i, [BOOTSTRAP_URL])
    clients.push(client)
    cleanups.push(cleanup)
  }

  return { clients, cleanup }

  async function cleanup () {
    for (let cleanupInstance of cleanups) {
      await cleanupInstance()
    }
    await bootstrapper.destroy()
  }
}

async function createOneDaemon () {
  const { clients, cleanup } = await createDaemon(1)
  return {
    client: clients[0],
    cleanup
  }
}

async function createDaemonInstance (id, port, bootstrap) {
  const { path, cleanup: dirCleanup } = await tmp.dir({ unsafeCleanup: true })

  const token = `test-token-${id}`
  const endpoint = `localhost:${port}`

  const daemon = new HyperdriveDaemon({
    storage: path,
    bootstrap,
    port,
    metadata: {
      token,
      endpoint
    }
  })
  await daemon.start()

  const client = new HyperdriveClient(endpoint, token)
  await client.ready()

  return {
    client,
    cleanup
  }

  async function cleanup () {
    await daemon.stop()
    await dirCleanup()
  }
}

async function createArchive (daemon, names, key = undefined) {
  var archive = await daemon.client.drive.get({key})
  return populate(archive, names)
}

async function createFs (names) {
  return populate(new ScopedFS((await tmp.dir({ unsafeCleanup: true })).path), names)
}

async function populate (target, names) {
  names = names || []
  for (var i = 0; i < names.length; i++) {
    let name = names[i]
    let content = 'content'
    if (typeof name === 'object') {
      content = name.content
      name = name.name
    }

    await new Promise(resolve => {
      if (name.slice(-1) === '/') {
        target.mkdir(name, resolve)
      } else {
        target.writeFile(name, content, resolve)
      }
    })
  }

  return target
}

function tonix (str) {
  return str.replace(/\\/g, '/')
}

module.exports = {FAKE_DAT_KEY, createDaemon, createOneDaemon, createArchive, createFs, tonix}
