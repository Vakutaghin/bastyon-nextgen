import styled from 'vue3-styled-components'
import { TRANSITIONS } from '@/styles/design-tokens'

export const SC_Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`

export const SC_Footer = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
`

export const SC_DismissButton = styled.button`
  background: var(--ui-primary);
  color: var(--ui-text-inverted);
  border: none;
  border-radius: var(--ui-radius-md);
  padding: 6px 12px;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  cursor: pointer;
  transition: background-color ${TRANSITIONS.QUICK};

  /* Цвет задан и здесь: иначе глобальный button:hover красил текст акцентом
     — зелёный на зелёном. */
  &:hover {
    background: rgb(var(--ui-primary-rgb) / 75%);
    color: var(--ui-text-inverted);
  }
`

/** Вкладки-pill, как переключатель языка в настройках. */
export const SC_LangSwitcher = styled.div`
  display: inline-flex;
  align-self: flex-start;
  gap: 2px;
  padding: 4px;
  background: var(--ui-bg-elevated);
  border-radius: var(--ui-radius-lg);
`

export const SC_LangButton = styled.button<{ active: boolean }>`
  padding: 2px 10px;
  font-size: 12px;
  font-weight: 500;
  line-height: 20px;
  background: ${(p) => (p.active ? 'var(--ui-primary)' : 'transparent')};
  color: ${(p) => (p.active ? 'var(--ui-text-inverted)' : 'var(--ui-text-muted)')};
  border: none;
  border-radius: var(--ui-radius-md);
  cursor: pointer;
  transition:
    background-color ${TRANSITIONS.QUICK},
    color ${TRANSITIONS.QUICK};

  &:hover {
    background: ${(p) => (p.active ? 'var(--ui-primary)' : 'transparent')};
    color: ${(p) => (p.active ? 'var(--ui-text-inverted)' : 'var(--ui-text-highlighted)')};
  }
`

export const SC_MarkdownBody = styled.div`
  color: var(--color-text-primary);
  font-size: 14px;
  line-height: 1.55;
  max-height: 60vh;
  overflow-y: auto;

  h1 {
    font-size: 18px;
    font-weight: 700;
    margin: 0 0 12px;
  }

  h2 {
    font-size: 15px;
    font-weight: 600;
    margin: 16px 0 8px;
  }

  h3 {
    font-size: 13px;
    font-weight: 600;
    margin: 12px 0 6px;
    color: var(--color-text-dark);
  }

  p {
    margin: 0 0 10px;
  }

  ul,
  ol {
    margin: 0 0 12px;
    padding-left: 22px;
  }

  li {
    margin: 4px 0;
  }

  a {
    color: var(--color-primary);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  code {
    background: var(--color-overlay-5);
    padding: 1px 5px;
    border-radius: var(--ui-radius-sm);
    font-size: 12.5px;
    font-family: var(--font-family-mono);
  }

  strong {
    font-weight: 600;
  }

  hr {
    border: none;
    border-top: 1px solid var(--color-border-lighter);
    margin: 16px 0;
  }
`
