import styled from 'vue3-styled-components'

export const SC_AudioVisualizer = styled.div`
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  z-index: 5; /* Above thumbnail (2), below controls (10) */
`
