import styled from 'vue3-styled-components'
import { BREAKPOINTS } from '@/styles/design-tokens'

// Общий каркас разделов «Видео» и «Аудио», страниц плейлиста и личного списка.

export const SC_SectionWork = styled.div`
  display: flex;
  flex: 1;
  width: 100%;
  min-height: calc(100vh - var(--header-height));
  align-items: flex-start;
  background: var(--color-bg-primary);
`

export const SC_SectionPage = styled.main`
  width: 100%;
  max-width: var(--content-max-width);
  margin: 0 auto;
  padding: calc(var(--header-height-total) + 24px) 24px 64px;

  &.narrow {
    max-width: 920px;
  }

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    padding: calc(var(--header-height-total) + 12px) 12px 40px;
  }
`

export const SC_SectionHead = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px 24px;
  margin-bottom: 12px;

  .search {
    flex: 1 1 280px;
    max-width: 480px;
    margin-left: auto;
  }

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    .search {
      max-width: none;
      margin-left: 0;
    }
  }
`

export const SC_SectionTitle = styled.h1`
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  letter-spacing: -0.5px;
  color: var(--ui-text-highlighted);
`

/** Вкладки раздела — ссылки: у каждой свой адрес, «Назад» работает. */
export const SC_Tabs = styled.nav`
  display: flex;
  gap: 4px;
  margin: 0 -24px 20px;
  padding: 0 24px;
  border-bottom: 1px solid var(--ui-border);
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }

  a {
    flex: none;
    padding: 10px 12px;
    border-bottom: 2px solid transparent;
    font-size: 14px;
    font-weight: 500;
    color: var(--ui-text-muted);
    text-decoration: none;
    white-space: nowrap;
  }

  a:hover {
    color: var(--ui-text);
  }

  a.active {
    color: var(--ui-text-highlighted);
    border-bottom-color: var(--ui-primary);
  }

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    margin: 0 -12px 16px;
    padding: 0 12px;
  }
`

export const SC_Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
`

export const SC_Chip = styled.button`
  height: 32px;
  padding: 0 14px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-full);
  background: var(--ui-bg);
  color: var(--ui-text);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;

  &:hover {
    border-color: var(--ui-border-accented);
  }

  &.active {
    background: var(--ui-text-highlighted);
    border-color: var(--ui-text-highlighted);
    color: var(--ui-bg);
  }
`

export const SC_Block = styled.section`
  margin-bottom: 32px;
`

export const SC_BlockHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
`

export const SC_BlockTitle = styled.h2`
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
`

export const SC_Note = styled.p`
  margin: 0 0 16px;
  font-size: 13px;
  line-height: calc(1.45 * var(--leading-scale));
  color: var(--ui-text-muted);
`

/** Плитки плейлистов: квадратные у аудио, широкие у видео. */
export const SC_CardsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 20px 16px;

  &.square {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  }

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px 12px;

    &.square {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
`

/** Личные списки строками: значок, название, сколько внутри. */
export const SC_ListRows = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-lg);
  overflow: hidden;

  li + li {
    border-top: 1px solid var(--ui-border);
  }

  a {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    color: var(--ui-text);
    text-decoration: none;
  }

  a:hover {
    background: var(--ui-bg-muted);
  }

  .icon {
    font-size: 18px;
    color: var(--ui-text-muted);
  }

  .name {
    flex: 1;
    min-width: 0;
    font-size: 14px;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .count {
    font-size: 13px;
    color: var(--ui-text-dimmed);
  }
`

export const SC_Empty = styled.div`
  padding: 40px 16px;
  text-align: center;
  font-size: 14px;
  color: var(--ui-text-muted);

  p {
    margin: 0 0 12px;
  }
`
