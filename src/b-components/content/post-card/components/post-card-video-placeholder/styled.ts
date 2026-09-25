import styled from 'vue3-styled-components'

export const SC_VideoPlaceholder = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: linear-gradient(
    135deg,
    var(--color-border-lighter) 0%,
    var(--color-border-light) 100%
  );
  border-radius: var(--ui-radius-lg);
  margin-bottom: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px dashed var(--color-border-light);

  .video-icon {
    font-size: 60px;
    color: var(--color-text-muted);
  }
`
