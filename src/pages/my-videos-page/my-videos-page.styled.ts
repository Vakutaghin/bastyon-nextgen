import styled from 'vue3-styled-components'
import { BREAKPOINTS } from '@/styles/design-tokens'
import { COLORS } from '@/styles/theme-colors'

export const SC_MyVideosWork = styled.div`
  display: flex;
  flex: 1;
  margin: 0 auto;
  width: 100%;
  min-height: calc(100vh - var(--header-height));
  padding: 0 0 25px;
  align-items: flex-start;
  background: var(--color-bg-primary);
`

export const SC_MyVideosPage = styled.main`
  width: 100%;
  max-width: 1600px;
  margin: 0 auto;
  padding: 60px 20px 24px;

  @media (max-width: ${() => BREAKPOINTS.TABLET}) {
    padding: var(--header-height-total) 16px 24px;
  }
`

export const SC_Header = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 24px 0;
`

export const SC_MyVideosTitle = styled.h1`
  font-size: 24px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
  margin: 0;
`

export const SC_Section = styled.section`
  margin-bottom: 32px;
`

export const SC_SectionHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
`

export const SC_SectionTitle = styled.h2`
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
`

export const SC_Note = styled.div`
  padding: 24px 0;
  font-size: 14px;
  color: var(--ui-text-muted);

  &.warning {
    padding: 8px 0;
    color: var(--ui-error);
  }
`

export const SC_Grid = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
`

export const SC_Card = styled.li`
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
`

export const SC_Thumb = styled.div`
  position: relative;
  aspect-ratio: 16 / 9;
  border-radius: var(--ui-radius-lg);
  overflow: hidden;
  background: var(--ui-bg-elevated);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
`

export const SC_Duration = styled.span`
  position: absolute;
  right: 6px;
  bottom: 6px;
  padding: 1px 6px;
  border-radius: var(--ui-radius-md);
  background: ${() => COLORS.OVERLAY_70};
  color: ${() => COLORS.WHITE};
  font-size: 12px;
`

export const SC_CardTitle = styled.div`
  color: var(--ui-text-highlighted);
  font-size: 14px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const SC_Badge = styled.span`
  align-self: flex-start;
  padding: 1px 8px;
  border-radius: var(--ui-radius-full);
  border: 1px solid var(--ui-border);
  color: var(--ui-text-muted);
  font-size: 12px;

  &.posted {
    border-color: var(--ui-primary);
    color: var(--ui-primary);
  }
`

export const SC_CardActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`
