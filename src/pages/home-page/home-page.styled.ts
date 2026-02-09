import styled from 'vue3-styled-components'


export const SC_HomeWork = styled.div`
  display: flex;
  flex: 1;
  max-width: 1600px;
  margin: 0 auto;
  width: 100%;
  min-height: calc(100vh - 20px);
  gap: 20px;
  padding: 58px 0 25px;
  align-items: flex-start;
  background: rgb(255, 255, 255);
`

export const SC_HomeMainContent = styled.div`
  flex: 1;
  min-width: 0;
  background: rgb(255, 255, 255);
  padding: 20px 0;
  border-radius: 8px;

  @media (max-width: 800px) {
    padding: 16px 10px 20px;
  }
`
