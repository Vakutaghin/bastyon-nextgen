import styled from 'vue3-styled-components'

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
  color: var(--color-text-secondary);
`

export const SC_NoMorePosts = styled.div`
  color: var(--ui-text-dimmed);
`

export const SC_EmptyFeed = styled.div`
  color: var(--ui-text-dimmed);
`

export const SC_ErrorMessage = styled.div`
  color: var(--color-red-ant);
  padding: 20px;
  text-align: center;
`

export const SC_InitialLoading = styled.div`
  padding: 40px;
  text-align: center;
`
