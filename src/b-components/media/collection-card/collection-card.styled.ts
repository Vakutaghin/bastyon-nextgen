import styled from 'vue3-styled-components'

export const SC_Card = styled.a`
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  color: inherit;
  text-decoration: none;

  &:hover img {
    transform: scale(1.03);
  }
`

export const SC_Cover = styled.div`
  position: relative;
  aspect-ratio: 16 / 9;
  border-radius: var(--ui-radius-lg);
  overflow: hidden;
  background: var(--ui-bg-muted);

  .square & {
    aspect-ratio: 1 / 1;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transition: transform var(--transition-fast);
  }
`

export const SC_CoverIcon = styled.span`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34px;
  color: var(--ui-text-dimmed);
`

export const SC_Count = styled.span`
  position: absolute;
  right: 6px;
  bottom: 6px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  border-radius: var(--ui-radius-sm);
  font-size: 12px;
  font-weight: 600;
  color: var(--color-white);
  background: var(--color-overlay-70);
`

export const SC_State = styled.span`
  position: absolute;
  left: 6px;
  top: 6px;
  padding: 2px 7px;
  border-radius: var(--ui-radius-sm);
  font-size: 12px;
  font-weight: 600;
  color: var(--ui-text-inverted);
  background: var(--ui-warning);

  &.failed {
    background: var(--ui-error);
  }
`

export const SC_Title = styled.span`
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 14px;
  font-weight: 600;
  line-height: calc(1.35 * var(--leading-scale));
  color: var(--ui-text-highlighted);
  word-break: break-word;
`

export const SC_Meta = styled.span`
  font-size: 12px;
  color: var(--ui-text-muted);
`
