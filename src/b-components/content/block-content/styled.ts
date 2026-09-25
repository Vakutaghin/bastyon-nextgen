import styled from 'vue3-styled-components'

export const SC_BlockContent = styled.div`
  width: 100%;
  color: var(--color-text-primary) !important;

  > * {
    margin-bottom: 1em;
    color: var(--color-text-primary) !important;
  }

  > *:last-child {
    margin-bottom: 0;
  }

  * {
    color: var(--color-text-primary) !important;
  }

  p {
    color: var(--color-text-primary) !important;
  }

  div {
    color: var(--color-text-primary) !important;
  }

  span {
    color: var(--color-text-primary) !important;
  }

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    color: var(--color-text-primary) !important;
  }
`
