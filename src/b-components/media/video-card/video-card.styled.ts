import styled from 'vue3-styled-components'

export const SC_Card = styled.article`
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;

  &.current img {
    outline: 3px solid var(--ui-primary);
    outline-offset: -3px;
  }
`

export const SC_ThumbLink = styled.a`
  position: relative;
  display: block;
  aspect-ratio: 16 / 9;
  border-radius: var(--ui-radius-lg);
  overflow: hidden;
  background: var(--ui-bg-muted);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transition: transform var(--transition-fast);
  }

  &:hover img {
    transform: scale(1.03);
  }
`

export const SC_ThumbFallback = styled.span`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36px;
  color: var(--ui-text-dimmed);
`

const BADGE = `
  position: absolute;
  padding: 1px 6px;
  border-radius: var(--ui-radius-sm);
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
  color: var(--color-white);
  background: var(--color-overlay-70);
  font-variant-numeric: tabular-nums;
`

export const SC_Duration = styled.span`
  ${() => BADGE}
  right: 6px;
  bottom: 6px;
`

export const SC_Badge = styled.span`
  ${() => BADGE}
  left: 6px;
  top: 6px;
`

export const SC_Info = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;

  .avatar {
    flex: none;
  }
`

export const SC_Text = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;

  .author {
    font-size: 13px;
    color: var(--ui-text-muted);
    text-decoration: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .author:hover {
    color: var(--ui-text);
  }
`

export const SC_Title = styled.a`
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 15px;
  font-weight: 600;
  line-height: calc(1.35 * var(--leading-scale));
  color: var(--ui-text-highlighted);
  text-decoration: none;
  word-break: break-word;

  &:hover {
    color: var(--ui-primary);
  }
`

export const SC_Meta = styled.span`
  font-size: 12px;
  color: var(--ui-text-dimmed);
`
