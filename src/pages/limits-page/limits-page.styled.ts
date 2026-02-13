import styled from 'vue3-styled-components'

export const SC_LimitsWork = styled.div`
  display: flex;
  flex: 1;
  margin: 0 auto;
  width: 100%;
  min-height: calc(100vh - 60px);
  padding: 0 0 25px;
  align-items: flex-start;
  background: rgb(255, 255, 255);
`

export const SC_LimitsPage = styled.div`
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  padding: 60px 20px 24px;
`

export const SC_LimitsTitle = styled.h1`
  font-size: 22px;
  font-weight: 600;
  color: rgb(33, 33, 33);
  margin: 0 0 24px;
`

export const SC_LimitsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

export const SC_LimitRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  background: rgb(249, 249, 249);
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.06);
`

export const SC_LimitLabel = styled.span`
  font-size: 15px;
  color: rgb(33, 33, 33);
`

export const SC_LimitValue = styled.span`
  font-size: 15px;
  font-weight: 500;
  color: rgb(33, 33, 33);
`

export const SC_LimitValueMuted = styled.span`
  font-size: 14px;
  font-weight: 400;
  color: rgb(120, 120, 120);
`

export const SC_LimitsLoading = styled.div`
  padding: 40px 0;
  text-align: center;
  font-size: 15px;
  color: rgb(120, 120, 120);
`

export const SC_LimitsError = styled.div`
  padding: 24px;
  background: rgba(220, 53, 69, 0.08);
  border-radius: 10px;
  font-size: 14px;
  color: rgb(180, 50, 50);
`
