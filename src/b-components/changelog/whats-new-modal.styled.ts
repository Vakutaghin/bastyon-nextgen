import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'
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
  background: var(--color-primary);
  color: var(--color-white);
  border: none;
  border-radius: var(--ui-radius-lg);
  padding: 8px 20px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color ${TRANSITIONS.QUICK};

  &:hover {
    background: var(--color-primary-hover);
  }
`

export const SC_LangSwitcher = styled.div`
  display: inline-flex;
  align-self: flex-start;
  border: 1px solid var(--color-border);
  border-radius: var(--ui-radius-lg);
  overflow: hidden;
`

export const SC_LangButton = styled.button<{ active: boolean }>`
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  background: ${(p) => (p.active ? COLORS.PRIMARY : 'transparent')};
  color: ${(p) => (p.active ? COLORS.WHITE : COLORS.TEXT_SECONDARY)};
  border: none;
  cursor: pointer;
  transition: background-color ${TRANSITIONS.QUICK};

  & + & {
    border-left: 1px solid var(--color-border);
  }

  &:hover {
    background: ${(p) => (p.active ? COLORS.PRIMARY : COLORS.PRIMARY_LIGHT)};
    color: ${(p) => (p.active ? COLORS.WHITE : COLORS.PRIMARY)};
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
