/**
 * Единый источник Content-Security-Policy (V26).
 *
 * В вебе политику задаёт `<meta http-equiv="Content-Security-Policy">` из
 * index.html. В бандле Tauri политику ставит заголовок из `tauri.conf.json`, а
 * meta никуда не девается (`tauri-utils/html.rs::inject_csp` только добавляет
 * свою) — и браузер обязан выполнить ОБЕ. Их пересечение запрещало то, что
 * разрешала каждая по отдельности: iframe удалённых мини-апп (meta разрешает
 * `https:`, заголовок — нет) и `http://127.0.0.1:*` для IPFS-viewer (наоборот).
 * В `tauri dev` этого не видно — там фронт отдаёт Vite без заголовка.
 *
 * Поэтому в Tauri-сборке meta убирается, и действует ровно одна политика —
 * из `tauri.conf.json`, где собраны директивы обеих.
 */

const META_CSP_RE = /\s*<meta\s+http-equiv=(?:"|')Content-Security-Policy(?:"|')[\s\S]*?\/?>\s*/i

/** Убирает meta-CSP из html. Возвращает html без изменений, если её нет. */
export function stripMetaCsp(html) {
  return html.replace(META_CSP_RE, '\n    ')
}

/** Плагин: снимает meta-CSP только в Tauri-сборке. */
export function cspSingleSource({ isTauri }) {
  return {
    name: 'csp-single-source',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return isTauri ? stripMetaCsp(html) : html
      },
    },
  }
}
