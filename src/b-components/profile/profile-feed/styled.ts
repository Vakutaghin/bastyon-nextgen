import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

export const SC_ProfileFeed = styled.div`
  width: 100%;
  margin: 0 auto;
`

export const SC_FeedContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`

export const SC_LoadMoreTrigger = styled.div`
  padding: 20px;
  text-align: center;
  min-height: 50px;
`

export const SC_LoadingSpinner = styled.div`
  color: ${COLORS.TEXT_SECONDARY};
`

export const SC_NoMorePosts = styled.div`
  color: ${COLORS.GRAY_999};
`

export const SC_EmptyFeed = styled.div`
  color: ${COLORS.GRAY_999};
`

export const SC_ErrorMessage = styled.div`
  color: ${COLORS.RED_ANT};
  padding: 20px;
  text-align: center;
`
