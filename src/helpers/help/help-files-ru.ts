// Статьи справки на русском. Отдельный модуль — отдельный чанк: его грузит
// help-load.ts при первом открытии справки, а не приложение при старте.
const modules = import.meta.glob<string>('/help/ru/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
})

export const HELP_FILES_RU: Record<string, string> = Object.fromEntries(
  Object.entries(modules).map(([path, text]) => [path.replace(/^\/help\//, ''), text])
)
