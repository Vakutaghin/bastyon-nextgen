// Статьи справки на английском — отдельный чанк, как и help-files-ru.ts.
const modules = import.meta.glob<string>('/help/en/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
})

export const HELP_FILES_EN: Record<string, string> = Object.fromEntries(
  Object.entries(modules).map(([path, text]) => [path.replace(/^\/help\//, ''), text])
)
