'use strict'

const promisify = require('promisify-es6')
const isIpfs = require('is-ipfs')
const setImmediate = require('async/setImmediate')
const doUntil = require('async/doUntil')
const CID = require('cids')
const { cidToString } = require('../../utils/cid')

module.exports = (self) => {
  return promisify(async (name, opts, cb) => {
    if (typeof opts === 'function') {
      cb = opts
      opts = {}
    }

    opts = opts || {}

    if (!isIpfs.path(name)) {
      return setImmediate(() => cb(new Error('invalid argument')))
    }

    // TODO remove this and update subsequent code when IPNS is implemented
    if (!isIpfs.ipfsPath(name)) {
      return setImmediate(() => cb(new Error('resolve non-IPFS names is not implemented')))
    }

    const split = name.split('/') // ['', 'ipfs', 'hash', ...path]
    const cid = new CID(split[2])

    if (split.length === 3) {
      return setImmediate(() => cb(null, `/ipfs/${cidToString(cid, { base: opts.cidBase })}`))
    }

    const path = split.slice(3).join('/')

    const results = self._ipld.resolve(cid, path)
    let value
    for await (const result of results) {
      if (result.remainderPath === '') {
        value = result.value
        break
      }
    }
    if (!CID.isCID(value)) {
      return cb(new Error('found non-link at given path'))
    } else {
      return cb(null, `/ipfs/${cidToString(value, { base: opts.cidBase })}`)
    }
  })
}
