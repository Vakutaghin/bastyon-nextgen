// Типы для Vite asset-импортов с суффиксом `?url` — Vite отдаёт URL ассета строкой.
// Например, иконка аккаунта: `import keyIcon from './key-icon.svg?url'`.
declare module '*?url' {
  const src: string
  export default src
}
