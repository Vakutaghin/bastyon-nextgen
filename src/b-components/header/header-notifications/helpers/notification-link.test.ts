import { describe, it, expect } from 'vitest'
import {
  classifyNotificationLink,
  isTrustedLinkHost,
  TRUSTED_LINK_HOSTS,
} from './notification-link'

describe('isTrustedLinkHost', () => {
  it('принимает точный доверенный хост', () => {
    for (const host of TRUSTED_LINK_HOSTS) {
      expect(isTrustedLinkHost(host)).toBe(true)
    }
  })

  it('принимает поддомены доверенных хостов', () => {
    expect(isTrustedLinkHost('www.bastyon.com')).toBe(true)
    expect(isTrustedLinkHost('cdn.pocketnet.app')).toBe(true)
  })

  it('нечувствителен к регистру', () => {
    expect(isTrustedLinkHost('Bastyon.COM')).toBe(true)
  })

  it('отвергает похожие, но чужие хосты (без ложного суффикс-матча)', () => {
    expect(isTrustedLinkHost('evilbastyon.com')).toBe(false)
    expect(isTrustedLinkHost('bastyon.com.evil.com')).toBe(false)
    expect(isTrustedLinkHost('notpocketnet.app')).toBe(false)
  })
})

describe('classifyNotificationLink', () => {
  it('доверенный http(s)-хост → та же вкладка', () => {
    expect(classifyNotificationLink('https://bastyon.com/post/abc')).toEqual({
      kind: 'same-tab',
      href: 'https://bastyon.com/post/abc',
    })
    expect(classifyNotificationLink('https://sub.pocketnet.app/x').kind).toBe('same-tab')
  })

  it('чужой http(s)-хост → новая вкладка', () => {
    expect(classifyNotificationLink('https://example.com/x')).toEqual({
      kind: 'new-tab',
      href: 'https://example.com/x',
    })
  })

  it('open-redirect на чужой http-хост НЕ навигирует в той же вкладке', () => {
    const action = classifyNotificationLink('http://evil.com')
    expect(action.kind).toBe('new-tab')
    expect(action.kind).not.toBe('same-tab')
  })

  it('нестандартные схемы (javascript:) игнорируются', () => {
    expect(classifyNotificationLink('javascript:alert(1)')).toEqual({ kind: 'ignore' })
    expect(classifyNotificationLink('data:text/html,<script>')).toEqual({ kind: 'ignore' })
  })

  it('относительный путь → router', () => {
    expect(classifyNotificationLink('/post/123')).toEqual({ kind: 'router', path: '/post/123' })
  })

  it('protocol-relative // игнорируется (не абсолютный, но и не роутер)', () => {
    expect(classifyNotificationLink('//evil.com')).toEqual({ kind: 'ignore' })
  })

  it('обрезает пробелы', () => {
    expect(classifyNotificationLink('  /profile/me  ')).toEqual({
      kind: 'router',
      path: '/profile/me',
    })
  })
})
