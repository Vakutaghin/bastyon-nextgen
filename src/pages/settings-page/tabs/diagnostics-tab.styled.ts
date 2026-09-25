import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_Diag = styled.section`
  display: flex;
  flex-direction: column;
  gap: 16px;
`

export const SC_DiagTitle = styled.h2`
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary);
`

export const SC_DiagGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`

export const SC_DiagGroupTitle = styled.h3`
  margin: 0 0 6px;
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
`

export const SC_DiagRow = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  padding: 7px 0;
  border-bottom: 1px solid var(--color-border-lighter);

  &:last-child {
    border-bottom: 0;
  }
`

export const SC_DiagLabel = styled.span`
  font-size: 14px;
  color: var(--color-text-secondary);
  flex-shrink: 0;
`

export const SC_DiagValue = styled.span`
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
  font-family: var(--font-family-mono);
  text-align: right;
  word-break: break-all;
`

/* Новые ячейки — на CSS-переменных: интерполяция COLORS.* в styled стоит ошибок
   типизации, а планка vue-tsc зафиксирована базовой линией. */
export const SC_DiagUpdateCell = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  flex-wrap: wrap;
`

export const SC_DiagUpdateButton = styled.button`
  background: transparent;
  color: var(--color-primary);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-sm);
  padding: 3px 12px;
  font-size: 13px;
  cursor: pointer;
  transition: background-color var(--transition-fast);

  &:hover:not(:disabled) {
    background: var(--color-primary-light);
    color: var(--color-primary);
  }

  &:disabled {
    cursor: default;
    opacity: 0.6;
  }
`
