import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_PostPage = styled.div`
  width: 100%;
  display: flex;
  justify-content: center;
`

export const SC_PostPageInner = styled.div`
  width: 100%;
  max-width: 680px;
  padding: 16px;
  box-sizing: border-box;
`

export const SC_PostStatus = styled.div`
  padding: 48px 16px;
  text-align: center;
  color: ${COLORS.TEXT_SECONDARY};
  font-size: 15px;
`
