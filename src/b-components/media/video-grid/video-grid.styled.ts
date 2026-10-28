import styled from 'vue3-styled-components'
import { BREAKPOINTS } from '@/styles/design-tokens'

export const SC_Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 24px 16px;

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    grid-template-columns: 1fr;
    gap: 20px;
  }
`

export const SC_Skeleton = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;

  .thumb {
    aspect-ratio: 16 / 9;
    height: auto !important;
    border-radius: var(--ui-radius-lg);
  }
`
