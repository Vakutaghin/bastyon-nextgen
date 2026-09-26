// Картинки и схемы справки (help/images): в сборку попадают файлами, здесь —
// только их адреса.
const modules = import.meta.glob<string>('/help/images/*.{svg,png,jpg,jpeg,webp,gif}', {
  eager: true,
  query: '?url',
  import: 'default',
})

export const HELP_IMAGES: Record<string, string> = Object.fromEntries(
  Object.entries(modules).map(([path, url]) => [path.replace(/^\/help\//, ''), url])
)
