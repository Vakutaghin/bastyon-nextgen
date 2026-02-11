import styled from 'vue3-styled-components'


export const SC_Feed = styled.div`
  width: 100%;
`

export const SC_FeedHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 15px;
  border-bottom: 1px solid rgba(206, 212, 218, 0.5);
`

export const SC_FeedHeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`

export const SC_SidebarToggleWrap = styled.div`
  height: 38px;
  display: inline-flex;
  align-items: center;

  button {
    height: 100% !important;
    min-height: 100% !important;
    padding: 0 12px;
  }

  .anticon {
    font-size: 16px;
  }
`

export const SC_FeedHeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

export const SC_FeedTitle = styled.h2`
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  color: rgb(33, 37, 41);
`

export const SC_FeedContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 15px;
`

export const SC_FeedLoading = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 500px;
  padding: 100px 20px;
  width: 100%;

  :deep(.ant-spin) {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 32px;
  }

  :deep(.ant-spin-spinning) {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 32px;
  }

  :deep(.anticon) {
    font-size: 120px !important;
    color: rgb(0, 123, 255) !important;
  }

  :deep(.ant-spin-text) {
    font-size: 24px !important;
    color: rgb(33, 37, 41) !important;
    font-weight: 500;
    margin-top: 0;
    letter-spacing: 1px;
  }
`

export const SC_FeedError = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 45px 22px;
  text-align: center;
  color: rgb(108, 117, 125);

  p {
    margin: 0;
    font-size: 15px;
  }
`

export const SC_FeedLoadingMore = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 30px 20px;
  width: 100%;
`

export const SC_FeedEnd = styled.div`
  text-align: center;
  padding: 30px 20px;
  color: rgb(108, 117, 125);
  font-size: 16px;

  p {
    margin: 0;
  }
`
