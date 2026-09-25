import styled from 'vue3-styled-components'
import { BREAKPOINTS, TRANSITIONS } from '@/styles/design-tokens'

export const SC_ExplorerWork = styled.div`
  display: flex;
  flex: 1;
  margin: 0 auto;
  width: 100%;
  min-height: calc(100vh - var(--header-height));
  align-items: flex-start;
  background: var(--color-bg-primary);
`

export const SC_ExplorerPage = styled.main`
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  /* Отступ сверху — высота фиксированной шапки плюс 28px воздуха. */
  padding: calc(var(--header-height-total) + 28px) 24px 48px;
`

export const SC_ExplorerHeader = styled.header`
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 32px;
`

export const SC_ExplorerTitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
`

export const SC_ExplorerTitle = styled.h1`
  font-size: 24px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
  margin: 0;
  letter-spacing: -0.5px;
`

export const SC_LiveBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
  text-transform: uppercase;
  border-radius: var(--ui-radius-md);
  color: var(--color-text-muted);
  background: var(--color-bg-disabled);
  transition:
    background-color ${TRANSITIONS.FAST},
    color ${TRANSITIONS.FAST};

  &.active {
    color: var(--color-success);
    background: var(--color-success-bg-tint);
  }
`

export const SC_LiveDot = styled.span`
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-text-muted);

  &.active {
    background: var(--color-success);
    animation: live-pulse 1.6s ease-in-out infinite;
  }

  @keyframes live-pulse {
    0%,
    100% {
      box-shadow: 0 0 0 0 var(--color-success-bg-pulse);
    }

    50% {
      box-shadow: 0 0 0 6px transparent;
    }
  }
`

export const SC_ExplorerSubtitle = styled.p`
  font-size: 14px;
  color: var(--color-text-secondary);
  margin: 0;
`

export const SC_ExplorerGrid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 20px;

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    grid-template-columns: 1fr;
  }
`

export const SC_ExplorerStatsRow = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 24px;

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`

export const SC_StatCard = styled.div`
  /* Карточка статистики как в Dashboard Nuxt UI: фон страницы и рамка. */
  padding: 16px 20px;
  background: var(--ui-bg);
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-lg);
`

export const SC_StatCardLabel = styled.div`
  font-size: 12px;
  font-weight: 500;
  color: var(--ui-text-muted);
  text-transform: uppercase;
  margin-bottom: 6px;
`

export const SC_StatCardValue = styled.div`
  font-size: 24px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
  font-variant-numeric: tabular-nums;
`

export const SC_StatCardHint = styled.div`
  font-size: 12px;
  color: var(--ui-text-dimmed);
  margin-top: 4px;
`

export const SC_SectionCard = styled.section`
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-lighter);
  border-radius: var(--ui-radius-lg);
  overflow: hidden;
`

export const SC_SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--ui-border);
`

// Капс-заголовок секции — общий примитив (audit §3.2).
export { SC_SectionTitle } from '@/styles/shared'

export const SC_RowList = styled.div`
  display: flex;
  flex-direction: column;
`

export const SC_BlockRow = styled.div`
  display: grid;
  grid-template-columns: 90px minmax(0, 1fr) 70px 110px;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--ui-border);
  font-size: 14px;

  @media (max-width: ${BREAKPOINTS.MOBILE}) {
    /* Card layout: [height] [ntx] [age], затем [hash] на новой строке. */
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 10px;
    padding: 12px 14px;

    & > :nth-child(1) {
      order: 0;
    } /* height */
    & > :nth-child(2) {
      order: 3;
      flex-basis: 100%;
      min-width: 0;
    } /* hash */
    & > :nth-child(3) {
      order: 1;
      margin-left: auto;
    } /* ntx */
    & > :nth-child(4) {
      order: 2;
    } /* age */
  }

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: var(--color-overlay-3);
  }
`

export const SC_BlockHeight = styled.div`
  font-weight: 500;
  color: var(--ui-text-highlighted);
  font-variant-numeric: tabular-nums;
`

export const SC_BlockNtx = styled.div`
  font-size: 12px;
  color: var(--color-text-secondary);
  text-align: right;
`

export const SC_BlockAge = styled.div`
  font-size: 12px;
  color: var(--color-text-muted);
  text-align: right;
  white-space: nowrap;
`

/** Номер блока — ссылка без собственного оформления, цвет от строки. */
export const SC_PlainLink = styled.a`
  color: inherit;
  text-decoration: none;
`

/** Ссылка в заголовке секции («Пиры»). */
export const SC_SectionLink = styled.a`
  font-size: 14px;
  font-weight: 500;
  color: var(--ui-primary-text);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`

/** Пояснение под списком блоков. */
export const SC_SectionNote = styled.div`
  padding: 16px 18px;
  font-size: 14px;
  color: var(--color-text-secondary);
`
