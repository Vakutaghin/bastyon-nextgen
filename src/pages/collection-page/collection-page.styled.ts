import styled from 'vue3-styled-components'
import { BREAKPOINTS } from '@/styles/design-tokens'

export const SC_Status = styled.p`
  padding: 32px 0;
  margin: 0;
  text-align: center;
  font-size: 14px;
  color: var(--ui-text-muted);
`

export const SC_Header = styled.header`
  display: flex;
  gap: 24px;
  margin-bottom: 28px;

  @media (max-width: ${() => BREAKPOINTS.TABLET}) {
    flex-direction: column;
    gap: 16px;
  }
`

export const SC_HeaderCover = styled.div`
  position: relative;
  flex: none;
  width: 360px;
  aspect-ratio: 16 / 9;
  border-radius: var(--ui-radius-xl);
  overflow: hidden;
  background: var(--ui-bg-muted);

  .square & {
    width: 220px;
    aspect-ratio: 1 / 1;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  @media (max-width: ${() => BREAKPOINTS.TABLET}) {
    width: 100%;

    .square & {
      width: min(220px, 60vw);
    }
  }
`

export const SC_CoverIcon = styled.span`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48px;
  color: var(--ui-text-dimmed);
`

export const SC_HeaderInfo = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;

  .author {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    align-self: flex-start;
    font-size: 14px;
    font-weight: 500;
    color: var(--ui-text);
    text-decoration: none;
  }

  .author:hover {
    color: var(--ui-primary);
  }
`

export const SC_Kind = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ui-text-dimmed);
`

export const SC_StateBadge = styled.span`
  padding: 1px 6px;
  border-radius: var(--ui-radius-sm);
  font-size: 11px;
  letter-spacing: 0;
  text-transform: none;
  color: var(--ui-text-inverted);
  background: var(--ui-warning);

  &.failed {
    background: var(--ui-error);
  }
`

export const SC_Name = styled.h1`
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.5px;
  line-height: calc(1.2 * var(--leading-scale));
  color: var(--ui-text-highlighted);
  word-break: break-word;

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    font-size: 22px;
  }
`

export const SC_Meta = styled.div`
  font-size: 13px;
  color: var(--ui-text-muted);
`

export const SC_Description = styled.p`
  margin: 4px 0 0;
  font-size: 14px;
  line-height: calc(1.5 * var(--leading-scale));
  color: var(--ui-text);
  white-space: pre-wrap;
  word-break: break-word;
`

export const SC_Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
`

export const SC_Removed = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding: 8px 12px;
  border-radius: var(--ui-radius-md);
  background: var(--ui-bg-muted);
  font-size: 13px;
  color: var(--ui-text-muted);
`

export const SC_Posts = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 720px;
`
