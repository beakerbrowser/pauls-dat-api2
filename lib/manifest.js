const {DRIVE_MANIFEST_FILENAME} = require('./const')
const {maybe} = require('./common')
const {readFile} = require('./read')
const {writeFile} = require('./write')

// helper to read the manifest into an object
function readManifest (archive, cb) {
  return maybe(cb, async function () {
    var data = await readFile(archive, DRIVE_MANIFEST_FILENAME)
    data = JSON.parse(data.toString())
    if (data.links) data.links = massageLinks(data.links)
    return data
  })
}

// helper to write a manifest object
function writeManifest (archive, manifest, cb) {
  manifest = generateManifest(manifest)
  return writeFile(archive, DRIVE_MANIFEST_FILENAME, JSON.stringify(manifest, null, 2), cb)
}

// helper to write updates to a manifest object
function updateManifest (archive, updates, cb) {
  return maybe(cb, async function () {
    var manifest
    try {
      manifest = await readManifest(archive)
    } catch (e) {
      manifest = {}
    }
    Object.assign(manifest, generateManifest(updates))
    return writeManifest(archive, manifest)
  })
}

// helper to generate a new index.json object
function generateManifest (manifest = {}) {
  var { url, title, description, type, memberOf, forkOf, author, links, web_root, fallback_page } = manifest
  if (isString(url)) manifest.url = url
  else delete manifest.url
  if (isString(title)) manifest.title = title
  else delete manifest.title
  if (isString(description)) manifest.description = description
  else delete manifest.description
  if (isString(type)) manifest.type = type
  else if (isArrayOfStrings(type)) manifest.type = type[0]
  else delete manifest.type
  if (isString(memberOf)) manifest.memberOf = memberOf
  else delete manifest.memberOf
  if (isString(forkOf)) manifest.forkOf = forkOf
  else delete manifest.forkOf
  if (isObject(links)) manifest.links = massageLinks(links)
  else delete manifest.links
  if (isString(web_root)) manifest.web_root = web_root
  else delete manifest.web_root
  if (isString(fallback_page)) manifest.fallback_page = fallback_page
  else delete manifest.fallback_page
  if (isObject(author)) {
    if (isString(author.url)) {
      manifest.author = author.url
    } else {
      delete manifest.author
    }
  } else if (!isString(author)) {
    delete manifest.author
  }
  return manifest
}

function massageLinks (links) {
  if (!links || typeof links !== 'object') return {}
  for (var rel in links) {
    // make each value an array
    links[rel] = Array.isArray(links[rel]) ? links[rel] : [links[rel]]
    // link-objects only
    links[rel] = links[rel]
      .map(link => {
        if (isString(link)) {
          return {href: link}
        }
        return link
      })
      .filter(isLinkObject)
    // remove empty arrays
    if (links[rel].length === 0) {
      delete links[rel]
    }
  }
  return links
}

function isString (v) {
  return typeof v === 'string'
}

function isArrayOfStrings (v) {
  return Array.isArray(v) && v.every(isString)
}

function isLinkObject (v) {
  return isObject(v) && v.href && typeof v.href === 'string'
}

function isObject (v) {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

module.exports = {readManifest, generateManifest, writeManifest, updateManifest}
