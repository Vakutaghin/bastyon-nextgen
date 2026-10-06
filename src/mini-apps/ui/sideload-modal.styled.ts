import styled from 'vue3-styled-components'
import { Z_INDEX } from '@/styles/design-tokens'

// Стили окна «открыть своё приложение». Раньше окно их не подключало и
// рисовалось голыми тегами, без полей ввода, а файл со стилями удалили как
// неиспользуемый.

export const SC_Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: ${() => Z_INDEX.MODAL};
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: var(--color-overlay-65);
`

export const SC_Dialog = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
  max-width: 440px;
  padding: 18px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-lg);
  background: var(--ui-bg);
`

export const SC_Title = styled.h3`
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
`

export const SC_Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 5px;
`

export const SC_Label = styled.span`
  font-size: 13px;
  color: var(--ui-text-muted);
`

export const SC_Input = styled.input`
  width: 100%;
  padding: 8px 12px;
  border: 0;
  border-radius: var(--ui-radius-md);
  box-shadow: inset 0 0 0 1px var(--ui-border-accented);
  background: var(--ui-bg);
  color: var(--ui-text-highlighted);
  font-size: 14px;

  &:focus {
    outline: none;
    box-shadow: inset 0 0 0 2px var(--ui-primary);
  }
`

export const SC_Hint = styled.span`
  font-size: 12px;
  color: var(--ui-text-dimmed);
`

export const SC_Error = styled.div`
  font-size: 13px;
  color: var(--ui-error);
  word-break: break-word;
`

export const SC_Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`

export const SC_Btn = styled('button', { primary: Boolean })`
  padding: 6px 14px;
  border: 0;
  border-radius: var(--ui-radius-md);
  box-shadow: ${(p) => (p.primary ? 'none' : 'inset 0 0 0 1px var(--ui-border-accented)')};
  background: ${(p) => (p.primary ? 'var(--ui-primary)' : 'var(--ui-bg)')};
  color: ${(p) => (p.primary ? 'var(--ui-text-inverted)' : 'var(--ui-text)')};
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity var(--transition-fast);

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
`
