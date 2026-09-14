// SSRF-фильтр URL из мини-приложений (V25).

import { describe, expect, it } from 'vitest'

import { classifyExternalUrl, isSafeExternalUrl } from './safe-external-url'

describe('classifyExternalUrl', () => {
  it('публичные https — ok', () => {
    for (const u of [
      'https://api.example.com/v1?x=1',
      'https://1.pocketnet.app:8899/rpc/getnodeinfo',
      'https://8.8.8.8/dns',
      'https://[2606:4700:4700::1111]/',
      'https://xn--80ak6aa92e.com/',
    ]) {
      expect(classifyExternalUrl(u), u).toBe('ok')
    }
  })

  it('не-https — bad_scheme, пока не разрешён http', () => {
    expect(classifyExternalUrl('http://api.example.com/')).toBe('bad_scheme')
    expect(classifyExternalUrl('http://api.example.com/', { allowHttp: true })).toBe('ok')
    for (const u of [
      'ftp://x.example/',
      'javascript:alert(1)',
      'file:///etc/passwd',
      'data:text/plain,x',
    ]) {
      expect(classifyExternalUrl(u, { allowHttp: true }), u).toBe('bad_scheme')
    }
  })

  it('loopback, приватные, link-local, localhost/.local — private_host', () => {
    for (const u of [
      'https://127.0.0.1/',
      'https://127.0.0.2:8080/',
      'https://localhost/',
      'https://api.localhost/',
      'https://10.0.0.5/',
      'https://172.16.0.1/',
      'https://172.31.255.255/',
      'https://192.168.1.1/',
      'https://169.254.169.254/latest/meta-data/',
      'https://100.64.1.1/',
      'https://0.0.0.0/',
      'https://[::1]/',
      'https://[::]/',
      'https://[fe80::1]/',
      'https://[fd12:3456::1]/',
      'https://[fc00::1]/',
      'https://[::ffff:127.0.0.1]/',
      'https://[::ffff:10.0.0.1]/',
      'https://[::ffff:c0a8:101]/',
      'https://printer.local/',
      'https://db.internal/',
      'https://nas.home.arpa/',
    ]) {
      expect(classifyExternalUrl(u), u).toBe('private_host')
    }
  })

  it('числовые формы IPv4 нормализуются парсером и ловятся', () => {
    for (const u of [
      'https://2130706433/',
      'https://0x7f000001/',
      'https://127.1/',
      'https://0177.0.0.1/',
    ]) {
      expect(classifyExternalUrl(u), u).toBe('private_host')
    }
  })

  it('граница приватного диапазона: 172.32.0.1 и 11.0.0.1 — публичные', () => {
    expect(classifyExternalUrl('https://172.32.0.1/')).toBe('ok')
    expect(classifyExternalUrl('https://11.0.0.1/')).toBe('ok')
    expect(classifyExternalUrl('https://192.169.0.1/')).toBe('ok')
  })

  it('allowLoopback открывает только loopback, не LAN', () => {
    const o = { allowLoopback: true, allowHttp: true }
    expect(classifyExternalUrl('http://localhost:3000/api', o)).toBe('ok')
    expect(classifyExternalUrl('http://127.0.0.1:8080/', o)).toBe('ok')
    expect(classifyExternalUrl('http://[::1]:8080/', o)).toBe('ok')
    expect(classifyExternalUrl('http://192.168.1.10/', o)).toBe('private_host')
    expect(classifyExternalUrl('http://169.254.169.254/', o)).toBe('private_host')
  })

  it('мусор — bad_url', () => {
    expect(classifyExternalUrl('')).toBe('bad_url')
    expect(classifyExternalUrl('not a url')).toBe('bad_url')
    expect(isSafeExternalUrl('https://example.com/')).toBe(true)
    expect(isSafeExternalUrl('https://10.1.1.1/')).toBe(false)
  })
})
