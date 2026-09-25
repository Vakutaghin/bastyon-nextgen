import styled from 'vue3-styled-components'

export const SC_SystemSection = styled.section`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 28px;
`

export const SC_SystemRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid var(--ui-border);

  &:last-child {
    border-bottom: 0;
  }
`

export const SC_SystemLabel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`

/** Подпись и описание строки — как у поля формы Nuxt UI. */
export const SC_SystemTitle = styled.span`
  font-size: 14px;
  font-weight: 500;
  color: var(--ui-text-highlighted);
`

export const SC_SystemHint = styled.span`
  font-size: 14px;
  color: var(--ui-text-muted);
`

/** Выбор варианта — вкладки-pill Nuxt UI, как язык и тема. */
export const SC_ScaleRow = styled.div`
  display: inline-flex;
  flex-shrink: 0;
  gap: 2px;
  padding: 4px;
  background: var(--ui-bg-elevated);
  border-radius: var(--ui-radius-lg);
`

const scaleProps = { active: Boolean }

export const SC_ScaleButton = styled('button', scaleProps)`
  padding: 4px 12px;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  cursor: pointer;
  border: none;
  border-radius: var(--ui-radius-md);
  background: ${(p) => (p.active ? 'var(--ui-primary)' : 'transparent')};
  color: ${(p) => (p.active ? 'var(--ui-text-inverted)' : 'var(--ui-text-muted)')};
  box-shadow: ${(p) => (p.active ? 'var(--ui-shadow-xs)' : 'none')};
  transition:
    background-color var(--transition-fast),
    color var(--transition-fast);

  &:hover {
    background: ${(p) => (p.active ? 'var(--ui-primary)' : 'transparent')};
    color: ${(p) => (p.active ? 'var(--ui-text-inverted)' : 'var(--ui-text-highlighted)')};
  }
`

export const SC_DangerButton = styled.button`
  flex-shrink: 0;
  /* Outline-кнопка цветом ошибки, как у Nuxt UI. */
  background: transparent;
  color: var(--ui-error);
  border: 0;
  box-shadow: inset 0 0 0 1px rgb(var(--ui-error-rgb) / 50%);
  border-radius: var(--ui-radius-md);
  padding: 6px 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color var(--transition-fast);

  &:hover:not(:disabled) {
    background: rgb(var(--ui-error-rgb) / 10%);
    color: var(--ui-error);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.75;
  }
`
