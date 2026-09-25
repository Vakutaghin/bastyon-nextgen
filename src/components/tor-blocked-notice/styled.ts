// CSS-переменные напрямую (а не ${COLORS.X}): интерполяция строк в шаблон
// vue3-styled-components даёт TS2345 в vue-tsc, а планка baseline не растёт.
import styled from 'vue3-styled-components'

/** Место iframe/плеера под Tor: объяснение вместо пустого фрейма (V21). */
export const SC_TorBlockedNotice = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border: 1px dashed var(--color-border);
  border-radius: var(--ui-radius-lg);
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
  font-size: 14px;
  line-height: 1.4;
  box-sizing: border-box;
`

export const SC_TorBlockedIcon = styled.span`
  flex: none;
  font-size: 18px;
  line-height: 1;
`
