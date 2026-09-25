// CSS-переменные напрямую (а не ${COLORS.X}): интерполяция строк в шаблон
// vue3-styled-components даёт TS2345 в vue-tsc, а планка baseline не растёт.
import styled from 'vue3-styled-components'

/** Заглушка на месте картинки: занимает тот же бокс, что и <img>. */
export const SC_TorImageGate = styled.button`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  min-height: 96px;
  padding: 12px;
  border: 1px dashed var(--color-border);
  border-radius: var(--ui-radius-lg);
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
  box-sizing: border-box;

  &:hover:not(:disabled) {
    color: var(--color-primary);
    border-color: var(--color-primary);
  }

  &:disabled {
    cursor: default;
  }
`

export const SC_TorImageIcon = styled.span`
  font-size: 20px;
  line-height: 1;
`
