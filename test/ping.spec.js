/* eslint-env mocha */
'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const chaiAsPromised = require('chai-as-promised')
const expect = chai.expect
chai.use(dirtyChai)
chai.use(chaiAsPromised)
const pull = require('pull-stream/pull')
const collect = require('pull-stream/sinks/collect')

const ipfsClient = require('../src')
const PingMessageStream = require('../src/utils/ping-message-stream')
const f = require('./utils/factory')

// Determine if a ping response object is a pong, or something else, like a status message
function isPong (pingResponse) {
  return Boolean(pingResponse && pingResponse.success && !pingResponse.text)
}

describe('.ping', function () {
  this.timeout(20 * 1000)

  let ipfs
  let ipfsd
  let other
  let otherd
  let otherId

  before(async function () {
    this.timeout(30 * 1000) // slow CI

    ipfsd = await f.spawn({
      initOptions: {
        bits: 1024,
        profile: 'test'
      }
    })
    ipfs = ipfsClient(ipfsd.apiAddr)

    otherd = await f.spawn({
      initOptions: {
        bits: 1024,
        profile: 'test'
      }
    })
    other = otherd.api

    const ma = (await ipfs.id()).addresses[0]
    await other.swarm.connect(ma)

    otherId = (await other.id()).id
  })

  after(async () => {
    if (ipfsd) {
      await ipfsd.stop()
    }

    if (otherd) {
      await otherd.stop()
    }
  })

  it('.ping with default n', async () => {
    const res = await ipfs.ping(otherId)

    expect(res).to.be.an('array')
    expect(res.filter(isPong)).to.have.lengthOf(1)
    res.forEach(packet => {
      expect(packet).to.have.keys('success', 'time', 'text')
      expect(packet.time).to.be.a('number')
    })

    const resultMsg = res.find(packet => packet.text.includes('Average latency'))
    expect(resultMsg).to.exist()
  })

  it('.ping with count = 2', async () => {
    const res = await ipfs.ping(otherId, { count: 2 })

    expect(res).to.be.an('array')
    expect(res.filter(isPong)).to.have.lengthOf(2)
    res.forEach(packet => {
      expect(packet).to.have.keys('success', 'time', 'text')
      expect(packet.time).to.be.a('number')
    })
    const resultMsg = res.find(packet => packet.text.includes('Average latency'))
    expect(resultMsg).to.exist()
  })

  it('.ping with n = 2', async () => {
    const res = await ipfs.ping(otherId, { n: 2 })

    expect(res).to.be.an('array')
    expect(res.filter(isPong)).to.have.lengthOf(2)
    res.forEach(packet => {
      expect(packet).to.have.keys('success', 'time', 'text')
      expect(packet.time).to.be.a('number')
    })
    const resultMsg = res.find(packet => packet.text.includes('Average latency'))
    expect(resultMsg).to.exist()
  })

  it('.ping fails with count & n', async function () {
    this.timeout(20 * 1000)

    await expect(ipfs.ping(otherId, { count: 2, n: 2 })).to.be.rejected()
  })

  it('.ping with Promises', async () => {
    const res = await ipfs.ping(otherId)
    expect(res).to.be.an('array')
    expect(res.filter(isPong)).to.have.lengthOf(1)
    res.forEach(packet => {
      expect(packet).to.have.keys('success', 'time', 'text')
      expect(packet.time).to.be.a('number')
    })
    const resultMsg = res.find(packet => packet.text.includes('Average latency'))
    expect(resultMsg).to.exist()
  })

  it('.pingPullStream', (done) => {
    pull(
      ipfs.pingPullStream(otherId),
      collect((err, data) => {
        expect(err).to.not.exist()
        expect(data).to.be.an('array')
        expect(data.filter(isPong)).to.have.lengthOf(1)
        data.forEach(packet => {
          expect(packet).to.have.keys('success', 'time', 'text')
          expect(packet.time).to.be.a('number')
        })
        const resultMsg = data.find(packet => packet.text.includes('Average latency'))
        expect(resultMsg).to.exist()
        done()
      })
    )
  })

  it('.pingReadableStream', (done) => {
    let packetNum = 0
    ipfs.pingReadableStream(otherId)
      .on('data', data => {
        expect(data).to.be.an('object')
        expect(data).to.have.keys('success', 'time', 'text')
        if (isPong(data)) packetNum++
      })
      .on('error', err => {
        expect(err).not.to.exist()
      })
      .on('end', () => {
        expect(packetNum).to.equal(1)
        done()
      })
  })

  it('message conversion fails if invalid message is received', () => {
    const messageConverter = new PingMessageStream()
    expect(() => {
      messageConverter.write({ some: 'InvalidMessage' })
    }).to.throw('Invalid ping message received')
  })
})
