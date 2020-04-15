const {maybe, massageMetadataOutput, toBeakerError} = require('./common')

// lookup information about a file
function stat (archive, name, opts, cb) {
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }

  return maybe(cb, new Promise((resolve, reject) => {
    // run stat operation
    archive.stat(name, opts, (err, st) => {
      if (err) reject(toBeakerError(err, 'stat'))
      else {
        // read download status
        st.blocks = 0 // TODO
        st.downloaded = 0
        if (!archive.key) {
          // fs, not an archive
          st.downloaded = st.blocks
        } else if (st.isFile()) {
          // TODO
          // if (archive.content && archive.content.length) {
            // st.downloaded = archive.content.downloaded(st.offset, st.offset + st.blocks)
          // }
        }
        massageMetadataOutput(st.metadata)
        resolve(st)
      }
    })
  }))
}

module.exports = {stat}
