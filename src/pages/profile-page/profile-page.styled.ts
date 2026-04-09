import styled from 'vue3-styled-components'

export const SC_ProfileWork = styled.div`
  display: flex;
  flex: 1;
  margin: 0 auto;
  width: 100%;
  min-height: calc(100vh - 60px);
  gap: 20px;
  padding: 0 0 25px;
  align-items: flex-start;
  background: rgb(255, 255, 255);
`

export const SC_ProfileMainContent = styled.div`
  flex: 1;
  min-width: 0;
  background: rgb(255, 255, 255);
  padding: 20px 0;
  border-radius: 8px;

  @media (max-width: 800px) {
    padding: 16px 10px 20px;
  }
`

export const SC_ProfilePage = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  padding-top: 60px;
`

export const SC_ProfileContentWrapper = styled.div`
  display: flex;
  width: 100%;
  margin: 0 auto;
  gap: 20px;
  max-width: 1600px;

  @media (max-width: 800px) {
    flex-direction: column;
    padding: 10px;
  }
`

export const SC_LoadingProfile = styled.div`
  text-align: center;
  padding: 40px;
  font-size: 18px;
  color: #666;
`

export const SC_ErrorProfile = styled.div`
  text-align: center;
  padding: 40px;
  font-size: 18px;
  color: #ff4d4f;
`

export const SC_PendingProfile = styled.div`
  text-align: center;
  padding: 40px 20px;
  font-size: 16px;
  color: #666;
  line-height: 1.6;

  .pending-icon {
    font-size: 48px;
    color: #faad14;
    margin-bottom: 16px;
  }

  .pending-title {
    font-size: 20px;
    font-weight: 500;
    color: #333;
    margin-bottom: 8px;
  }
`
