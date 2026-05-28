import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_MyVideosWork = styled.div`
  display: flex;
  flex: 1;
  margin: 0 auto;
  width: 100%;
  min-height: calc(100vh - 60px);
  padding: 0 0 25px;
  align-items: flex-start;
  background: ${COLORS.WHITE};
`

export const SC_MyVideosPage = styled.main`
  width: 100%;
  max-width: 1600px;
  margin: 0 auto;
  padding: 60px 20px 24px;
`

export const SC_MyVideosTitle = styled.h1`
  font-size: 22px;
  font-weight: 600;
  color: ${COLORS.GRAY_212};
  margin: 24px 0;
`

export const SC_MyVideosPlaceholder = styled.div`
  padding: 40px 0;
  text-align: center;
  font-size: 15px;
  color: ${COLORS.GRAY_120};
`
