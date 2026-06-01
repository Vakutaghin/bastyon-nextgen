// Типы для Vite asset-импортов с суффиксом `?url` — Vite отдаёт URL ассета строкой.
// Нужно, например, для self-hosted ядра ffmpeg.wasm: `import coreURL from '@ffmpeg/core?url'`.
declare module '*?url' {
  const src: string
  export default src
}
