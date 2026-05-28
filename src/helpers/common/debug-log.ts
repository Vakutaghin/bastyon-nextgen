/**
 * Отладочный логгер. Используем вместо `console.log` для структурированных
 * отладочных сообщений (`[REG]`, `[WS]`, ...), которые нужно сохранить в коде,
 * но молча подавить в продакшене.
 *
 * Под капотом — обычный `console.log`. Глобально подавляется в `silence-console.ts`,
 * раскрывается через `?debug=1` или `localStorage.debug='1'`.
 *
 * Eslint `no-console` запрещает прямой `console.log` — этот файл единственное
 * разрешённое место.
 */
// eslint-disable-next-line no-console
export const debugLog: (...args: unknown[]) => void = (...args) => console.log(...args)
