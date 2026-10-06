import styled from 'vue3-styled-components'
import { BREAKPOINTS } from '@/styles/design-tokens'

/** Полка как карточка ленты, с лёгким акцентом, чтобы её заметили. */
export const SC_Shelf = styled.section`
  margin-bottom: 15px;
  padding: 14px 16px 12px;
  border: 1px solid rgb(var(--ui-primary-rgb) / 25%);
  border-radius: var(--ui-radius-lg);
  background: linear-gradient(135deg, rgb(var(--ui-primary-rgb) / 8%), var(--ui-bg) 60%);

  @media (max-width: ${() => BREAKPOINTS.TABLET}) {
    margin-bottom: 10px;
    padding: 12px 12px 10px;
  }

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    margin-bottom: 8px;
  }
`

export const SC_ShelfHead = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 10px;
`

export const SC_ShelfHeadText = styled.div`
  flex: 1 1 auto;
  min-width: 0;
`

export const SC_ShelfTitle = styled.h2`
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  line-height: 22px;
  color: var(--ui-text-highlighted);

  & > svg,
  & > .anticon {
    color: var(--ui-primary);
    font-size: 18px;
  }
`

export const SC_ShelfHint = styled.p`
  margin: 2px 0 0;
  font-size: 13px;
  line-height: 18px;
  color: var(--ui-text-muted);
`

export const SC_ShelfAll = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex: 0 0 auto;
  padding: 2px 6px;
  border: 0;
  border-radius: var(--ui-radius-md);
  background: none;
  color: var(--ui-primary);
  font-size: 13px;
  font-weight: 500;
  line-height: 22px;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color var(--transition-fast);

  &:hover {
    background: rgb(var(--ui-primary-rgb) / 10%);
  }
`

export const SC_ShelfClose = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 0;
  border-radius: var(--ui-radius-md);
  background: none;
  color: var(--ui-text-dimmed);
  font-size: 14px;
  cursor: pointer;
  transition:
    background-color var(--transition-fast),
    color var(--transition-fast);

  &:hover {
    background: var(--ui-bg-elevated);
    color: var(--ui-text);
  }
`

/** Ряд плиток с горизонтальной прокруткой: на телефоне листается пальцем. */
export const SC_ShelfRow = styled.div`
  display: flex;
  gap: 6px;
  margin: 0 -4px;
  padding: 0 4px 4px;
  overflow-x: auto;
  scroll-snap-type: x proximity;
  scrollbar-width: thin;
`

export const SC_ShelfTile = styled.button`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  flex: 0 0 84px;
  padding: 6px 4px;
  border: 0;
  border-radius: var(--ui-radius-lg);
  background: none;
  color: var(--ui-text);
  font: inherit;
  cursor: pointer;
  scroll-snap-align: start;
  transition: background-color var(--transition-fast);

  &:hover {
    background: rgb(var(--ui-bg-elevated-rgb) / 70%);
  }

  /* На телефоне следующая плитка выглядывает из-за края: видно, что ряд листается. */
  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    flex-basis: 72px;
  }
`

export const SC_ShelfIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: var(--ui-radius-xl);
  overflow: hidden;
  background: var(--color-overlay-4);
  font-size: 18px;
  font-weight: 500;
  color: var(--color-text-secondary);

  & > img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &.skeleton {
    background: var(--ui-bg-elevated);
  }
`

export const SC_ShelfName = styled.span`
  width: 100%;
  font-size: 12px;
  line-height: 15px;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-word;
`
