import styled from 'vue3-styled-components'
import { BREAKPOINTS } from '@/styles/design-tokens'

/** Период и график активности на «Обзоре». */
export const SC_ActivityBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
  min-width: 0;
`

export const SC_StatsTop = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 16px;
`

/** Графики — по два в ряд, широкие — во всю строку; на телефоне — столбиком. */
export const SC_ChartsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;

  > .wide {
    grid-column: 1 / -1;
  }

  @media (max-width: ${() => BREAKPOINTS.TABLET}) {
    grid-template-columns: minmax(0, 1fr);
  }
`

export const SC_SectionNote = styled.p`
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--ui-text-muted);
`
