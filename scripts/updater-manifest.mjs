#!/usr/bin/env node
// latest.json для обновления изнутри приложения (helpers/updates/install-update):
// по записи на систему — подпись minisign файла обновления и его адрес в этом
// релизе. Записи оставляют сборки release.yml, по JSON-файлу на систему; здесь
// они сводятся в манифест, который приложение берёт по адресу
// releases/latest/download/latest.json.
//
//   node scripts/updater-manifest.mjs <тег> <папка с записями> > latest.json

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

/** Системы, для которых релиз обязан нести обновление (ключи апдейтера Tauri). */
export const UPDATER_PLATFORMS = ['darwin-aarch64', 'darwin-x86_64', 'linux-x86_64', 'windows-x86_64']

/**
 * Сводит записи сборок в latest.json. Падает, если системы не хватает, если
 * она встречается дважды, если нет подписи или файл лежит не в этом релизе:
 * такой манифест приложение отвергло бы уже у пользователей.
 */
export function composeManifest({ tag, repo, fragments, pubDate }) {
  const releaseUrl = `https://github.com/${repo}/releases/download/${tag}/`
  const platforms = {}
  for (const fragment of fragments) {
    for (const [platform, entry] of Object.entries(fragment)) {
      if (!UPDATER_PLATFORMS.includes(platform)) throw new Error(`unknown platform ${platform}`)
      if (platforms[platform]) throw new Error(`two updates for ${platform}`)
      const signature = typeof entry?.signature === 'string' ? entry.signature.trim() : ''
      if (!signature) throw new Error(`${platform}: no signature`)
      if (typeof entry.url !== 'string' || !entry.url.startsWith(releaseUrl)) {
        throw new Error(`${platform}: url outside ${tag}: ${entry.url}`)
      }
      platforms[platform] = { signature, url: entry.url }
    }
  }
  const missing = UPDATER_PLATFORMS.filter((p) => !platforms[p])
  if (missing.length > 0) throw new Error(`no update for ${missing.join(', ')}`)
  return {
    version: tag.replace(/^v/, ''),
    notes: `https://github.com/${repo}/releases/tag/${tag}`,
    pub_date: pubDate,
    platforms,
  }
}

function readFragments(dir) {
  return readdirSync(dir, { recursive: true })
    .map(String)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => JSON.parse(readFileSync(join(dir, name), 'utf8')))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [tag, dir] = process.argv.slice(2)
  if (!tag || !dir) {
    console.error('usage: updater-manifest.mjs <tag> <fragments dir>')
    process.exit(2)
  }
  const manifest = composeManifest({
    tag,
    repo: process.env.GITHUB_REPOSITORY || 'Vakutaghin/bastyon-nextgen',
    fragments: readFragments(dir),
    pubDate: new Date().toISOString(),
  })
  process.stdout.write(JSON.stringify(manifest, null, 2) + '\n')
}
