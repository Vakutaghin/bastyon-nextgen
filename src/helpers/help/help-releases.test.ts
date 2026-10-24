// История версий в справке собирается из changelogs/: статья на версию и
// список версий в конце книги «История версий».
import { describe, expect, it } from 'vitest'
import { getReleasedChangelogEntries } from '@/helpers/changelog/changelog-loader'
import { releaseHelpFiles, releaseTopicId } from './help-releases'

describe('releaseHelpFiles', () => {
  it('имя статьи версии — латиница, цифры и дефисы', () => {
    expect(releaseTopicId('0.13.3')).toBe('release-0-13-3')
    expect(releaseTopicId('1.0.0-Beta.2')).toBe('release-1-0-0-beta-2')
  })

  it('статья на каждую вышедшую версию и список в конце книги', () => {
    const entries = getReleasedChangelogEntries()
    const book = '# История версий\n\nВступление.\n\n## Все версии\n'
    const { files, ids } = releaseHelpFiles('ru', { 'ru/releases.md': book })
    expect(ids).toEqual(entries.map((e) => releaseTopicId(e.version)))
    const newest = entries[0]!
    expect(files[`ru/${ids[0]}.md`]).toMatch(
      new RegExp(`^# ${newest.displayVersion.replace(/\./g, '\\.')} `)
    )
    const list = files['ru/releases.md']!
    expect(list.startsWith(book.trimEnd())).toBe(true)
    expect(list).toContain(`- [${newest.displayVersion} — `)
    expect(list).toContain(`](${ids[0]}.md)`)
    expect(
      list
        .trimEnd()
        .split('\n')
        .filter((l) => l.startsWith('- ['))
    ).toHaveLength(ids.length)
  })

  it('английская справка: свои тексты и русские как основные', () => {
    const { files, ids } = releaseHelpFiles('en', {
      'ru/releases.md': '# История\n',
      'en/releases.md': '# History\n',
    })
    expect(files[`ru/${ids[0]}.md`]).toBeDefined()
    expect(files[`en/${ids[0]}.md`]).toBeDefined()
    expect(files['en/releases.md']).toContain(`](${ids[0]}.md)`)
  })
})
