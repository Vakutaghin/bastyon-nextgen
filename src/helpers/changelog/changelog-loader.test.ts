import { describe, expect, it } from 'vitest'
import {
  CURRENT_APP_VERSION,
  getAllChangelogEntries,
  getChangelogEntryForVersion,
} from './changelog-loader'

// N34: «Что нового» ключевалось на самой свежей папке changelogs/, а не на
// версии сборки — подготовленный заранее релиз всплывал у текущих пользователей.
describe('getChangelogEntryForVersion', () => {
  it('для версии приложения отдаёт её changelog', () => {
    const entry = getChangelogEntryForVersion(CURRENT_APP_VERSION)
    expect(entry?.version).toBe(CURRENT_APP_VERSION)
  })

  it('версия без своей папки получает ближайшую НЕ новее себя', () => {
    const versions = getAllChangelogEntries().map((e) => e.version)
    expect(versions.length).toBeGreaterThan(0)
    const oldest = versions[versions.length - 1]!

    // Промежуточная версия: берём запись не новее.
    const entry = getChangelogEntryForVersion(`${oldest}1`)
    expect(entry).toBeDefined()
    expect(entry!.version <= `${oldest}1`).toBe(true)
  })

  it('версия старше всех известных — ничего не показываем', () => {
    expect(getChangelogEntryForVersion('0.0.1')).toBeUndefined()
  })
})
