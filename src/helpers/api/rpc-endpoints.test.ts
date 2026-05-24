import { describe, it, expect } from 'vitest'
import { rpcEndpoints, getRpcPath } from './rpc-endpoints'

describe('rpcEndpoints', () => {
  it('has user methods', () => {
    expect(rpcEndpoints.getUserProfile).toBe('getuserprofile')
    expect(rpcEndpoints.getUserState).toBe('getuserstate')
  })

  it('has feed methods', () => {
    expect(rpcEndpoints.getHierarchicalStrip).toBe('gethierarchicalstrip')
    expect(rpcEndpoints.getTopFeed).toBe('gettopfeed')
  })

  it('has transaction methods', () => {
    expect(rpcEndpoints.txUnspent).toBe('txunspent')
    expect(rpcEndpoints.sendRawTransactionWithMessage).toBe('sendrawtransactionwithmessage')
  })

  it('has block explorer methods', () => {
    expect(rpcEndpoints.getCoinInfo).toBe('getcoininfo')
    expect(rpcEndpoints.getLastBlocks).toBe('getlastblocks')
    expect(rpcEndpoints.getCompactBlock).toBe('getcompactblock')
    expect(rpcEndpoints.getBlockTransactions).toBe('getblocktransactions')
    expect(rpcEndpoints.getTransactions).toBe('gettransactions')
    expect(rpcEndpoints.getAddressInfo).toBe('getaddressinfo')
    expect(rpcEndpoints.getAddressTransactions).toBe('getaddresstransactions')
    expect(rpcEndpoints.searchByHash).toBe('searchbyhash')
  })
})

describe('getRpcPath', () => {
  it('uses /rpc/ for regular methods', () => {
    expect(getRpcPath('getuserprofile')).toBe('/rpc/getuserprofile')
  })

  it('uses /rpc-ex/ for feed methods', () => {
    expect(getRpcPath('gethierarchicalstrip')).toBe('/rpc-ex/gethierarchicalstrip')
    expect(getRpcPath('gettopfeed')).toBe('/rpc-ex/gettopfeed')
    expect(getRpcPath('getprofilefeed')).toBe('/rpc-ex/getprofilefeed')
    expect(getRpcPath('getsubscribesfeed')).toBe('/rpc-ex/getsubscribesfeed')
    expect(getRpcPath('getmostcommentedfeed')).toBe('/rpc-ex/getmostcommentedfeed')
    expect(getRpcPath('getboostfeed')).toBe('/rpc-ex/getboostfeed')
  })

  it('uses /rpc-ex/ when useEx=true', () => {
    expect(getRpcPath('getuserprofile', true)).toBe('/rpc-ex/getuserprofile')
  })

  it('uses /rpc/ when useEx=false for non-ex method', () => {
    expect(getRpcPath('getuserprofile', false)).toBe('/rpc/getuserprofile')
  })
})
