/** Типы плагина сборки `vite-plugin-csp.js` (V26) — нужны тесту в src/config. */
export declare function stripMetaCsp(html: string): string
export declare function cspSingleSource(opts: { isTauri: boolean }): {
  name: string
  transformIndexHtml: { order: 'pre'; handler(html: string): string }
}
