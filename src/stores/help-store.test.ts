import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useHelpStore } from './help-store'

describe('help-store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('панель: открыть статью, перейти по ссылке, назад, закрыть', () => {
    const help = useHelpStore()
    expect(help.panelTopic).toBeNull()
    help.openTopic('faq')
    help.followInPanel('glossary')
    help.followInPanel('glossary')
    expect(help.panel).toEqual(['faq', 'glossary'])
    help.backInPanel()
    expect(help.panelTopic).toBe('faq')
    help.backInPanel()
    expect(help.panelTopic).toBe('faq')
    help.openTopic('about')
    expect(help.panel).toEqual(['about'])
    help.closePanel()
    expect(help.panelTopic).toBeNull()
  })

  it('избранное и скрытый навигатор переживают перезапуск', () => {
    const help = useHelpStore()
    help.toggleFavorite('faq')
    help.toggleFavorite('about')
    help.toggleFavorite('faq')
    help.setNavHidden(true)

    setActivePinia(createPinia())
    const again = useHelpStore()
    expect(again.favorites).toEqual(['about'])
    expect(again.isFavorite('about')).toBe(true)
    expect(again.navHidden).toBe(true)
  })

  it('испорченное хранилище не ломает справку', () => {
    localStorage.setItem('bastyon_help_favorites', '{не json')
    expect(useHelpStore().favorites).toEqual([])
    setActivePinia(createPinia())
    localStorage.setItem('bastyon_help_favorites', JSON.stringify(['faq', 42, null]))
    expect(useHelpStore().favorites).toEqual(['faq'])
  })
})
