import styled from 'vue3-styled-components'

export const SC_ModalWrapper = styled.div`
  :global(.registration-validation-modal-wrap) {
    .ant-modal {
      max-width: 500px;
    }

    .ant-modal-body {
      padding: 2em;
    }
  }
`

export const SC_Content = styled.div`
  text-align: center;
  padding: 1em 0;
`

export const SC_IconWrapper = styled.div`
  margin-bottom: 1.5em;
`

export const SC_Icon = styled.div`
  font-size: 4em;
  line-height: 1;
`

export const SC_Title = styled.h2`
  font-size: 1.5em;
  font-weight: 700;
  margin-bottom: 1em;
  color: var(--color-text-primary);
`

export const SC_Message = styled.p`
  font-size: 1.1em;
  margin-bottom: 1.5em;
  color: var(--color-text-primary);
  line-height: 1.5;
`

export const SC_Info = styled.p`
  font-size: 0.9em;
  color: var(--color-gray-999);
  line-height: 1.5;
  margin-top: 1em;
`
