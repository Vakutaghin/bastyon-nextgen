import styled from 'vue3-styled-components'

export const SC_VideoPlaceholder = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: linear-gradient(135deg, rgba(206, 212, 218, 0.3) 0%, rgba(206, 212, 218, 0.5) 100%);
  border-radius: 8px;
  margin-bottom: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px dashed rgba(206, 212, 218, 0.6);

  .video-icon {
    font-size: 60px;
    color: rgba(33, 37, 41, 0.4);
  }
`
