/**
 * Утилитарные текстовые обёртки для block-explorer — заменяют inline `style="..."`
 * биндинги (см. CODE_AUDIT.md §3.1). Локальны для block-explorer'а — другие зоны
 * пусть заводят свои, чтобы не плодить «глобальные» утилиты.
 */
import styled from 'vue3-styled-components'

/** Приглушённый серый текст (empty-value заглушки, второстепенный мета-инфо). */
export const SC_Muted = styled.span`
  color: var(--color-text-muted);
`

/** Тот же серый, но мельче — подписи под значениями. */
export const SC_MutedSm = styled.span`
  color: var(--color-text-muted);
  font-size: 12px;
`

/** Сильно мельче, со смещением — слабо-видный счётчик/timestamp. */
export const SC_MutedXs = styled.span`
  color: var(--color-text-muted);
  font-size: 11px;
  margin-top: 2px;
`

/** Серый + размер + горизонтальный отступ — used в строке tx-page. */
export const SC_MutedSmInline = styled.span`
  color: var(--color-text-muted);
  font-size: 12px;
  margin-left: 8px;
`

/** Второстепенный текст (тёмный серый). */
export const SC_Subtle = styled.span`
  color: var(--color-text-secondary);
`

/** Моноширинные цифры — для address/hash/blocknumber. */
export const SC_TabularNums = styled.span`
  font-variant-numeric: tabular-nums;
`
