/**
 * Утилитарные текстовые обёртки для block-explorer — заменяют inline `style="..."`
 * биндинги (см. CODE_AUDIT.md §3.1). Локальны для block-explorer'а — другие зоны
 * пусть заводят свои, чтобы не плодить «глобальные» утилиты.
 */
import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

/** Приглушённый серый текст (empty-value заглушки, второстепенный мета-инфо). */
export const SC_Muted = styled.span`
  color: ${COLORS.TEXT_MUTED};
`

/** Тот же серый, но мельче — подписи под значениями. */
export const SC_MutedSm = styled.span`
  color: ${COLORS.TEXT_MUTED};
  font-size: 12px;
`

/** Сильно мельче, со смещением — слабо-видный счётчик/timestamp. */
export const SC_MutedXs = styled.span`
  color: ${COLORS.TEXT_MUTED};
  font-size: 11px;
  margin-top: 2px;
`

/** Серый + размер + горизонтальный отступ — used в строке tx-page. */
export const SC_MutedSmInline = styled.span`
  color: ${COLORS.TEXT_MUTED};
  font-size: 12px;
  margin-left: 8px;
`

/** Второстепенный текст (тёмный серый). */
export const SC_Subtle = styled.span`
  color: ${COLORS.TEXT_SECONDARY};
`

/** Моноширинные цифры — для address/hash/blocknumber. */
export const SC_TabularNums = styled.span`
  font-variant-numeric: tabular-nums;
`

/** Простой primary-link — для inline-ссылок в значениях. */
export const SC_LinkPrimary = styled.a`
  color: ${COLORS.PRIMARY};
  text-decoration: none;
`

export const SC_LinkPrimaryInline = styled.a`
  color: ${COLORS.PRIMARY};
  text-decoration: none;
  margin-right: 6px;
`
