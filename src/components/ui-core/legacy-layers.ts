/**
 * Окна antd на переходный период: пока они ещё есть, свой слой, открытый из
 * такого окна, должен встать над ним. Уходит вместе с antd.
 */

/** Открытые окна и шторки antd. */
const LEGACY_OVERLAYS = '.ant-modal-wrap, .ant-drawer.ant-drawer-open'

/** Наибольший z-index видимых окон antd; 0 — их нет. */
export function legacyOverlayZ(doc: Document = document): number {
  let max = 0
  for (const el of doc.querySelectorAll<HTMLElement>(LEGACY_OVERLAYS)) {
    // Закрытое окно antd остаётся в DOM с display: none (или внутри скрытого).
    const style = getComputedStyle(el)
    if (style.display === 'none' || el.getClientRects().length === 0) continue
    const z = parseInt(style.zIndex, 10)
    if (Number.isFinite(z) && z > max) max = z
  }
  return max
}
