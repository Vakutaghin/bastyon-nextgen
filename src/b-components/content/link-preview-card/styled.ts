import styled from 'vue3-styled-components'

import { BREAKPOINTS, FONT_SIZE, SPACING } from '@/styles/design-tokens'

const wideProps = { wide: Boolean }

export const SC_LinkPreviewWrap = styled.div`
  position: relative;
  margin: ${() => SPACING.SM} 0;

  &:empty {
    margin: 0;
  }
`

/** Широкая OG-картинка (≥ 500px, как у старого клиента) — сверху; узкая — миниатюрой справа. */
export const SC_Card = styled('a', wideProps)`
  display: flex;
  flex-direction: ${(props) => (props.wide ? 'column' : 'row-reverse')};
  align-items: stretch;
  overflow: hidden;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-lg);
  background: var(--ui-bg-elevated);
  color: var(--ui-text);
  text-decoration: none;

  &:hover {
    background: var(--ui-bg-muted);
  }

  &:focus-visible {
    outline: 2px solid var(--ui-focus-outline);
    outline-offset: 2px;
  }
`

export const SC_Media = styled('div', wideProps)`
  flex-shrink: 0;
  width: ${(props) => (props.wide ? '100%' : '120px')};
  aspect-ratio: ${(props) => (props.wide ? '1.91 / 1' : '1 / 1')};
  max-height: ${(props) => (props.wide ? '320px' : 'none')};
  background: var(--ui-bg-muted);

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  button {
    width: 100%;
    height: 100%;
    font-size: ${() => FONT_SIZE.SM};
  }

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    width: ${(props) => (props.wide ? '100%' : '84px')};
  }
`

export const SC_Body = styled.div`
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: ${() => SPACING.XS};
  min-width: 0;
  padding: ${() => SPACING.SM} ${() => SPACING.MD};
`

export const SC_Site = styled.div`
  overflow: hidden;
  font-size: ${() => FONT_SIZE.SM};
  color: var(--ui-text-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const SC_Title = styled.div`
  display: -webkit-box;
  overflow: hidden;
  font-size: ${() => FONT_SIZE.MD};
  font-weight: 600;
  line-height: 1.35;
  color: var(--ui-text-highlighted);
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
`

export const SC_Description = styled.div`
  display: -webkit-box;
  overflow: hidden;
  font-size: ${() => FONT_SIZE.SM};
  line-height: 1.4;
  color: var(--ui-text-toned);
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
`

export const SC_Remove = styled.button`
  position: absolute;
  top: ${() => SPACING.XS};
  right: ${() => SPACING.XS};
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: var(--ui-radius-full);
  background: rgb(var(--color-black-rgb) / 55%);
  color: var(--color-white);
  cursor: pointer;

  &:hover:not(:disabled) {
    background: rgb(var(--color-black-rgb) / 75%);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  &:focus-visible {
    outline: 2px solid var(--ui-focus-outline);
    outline-offset: 2px;
  }
`
