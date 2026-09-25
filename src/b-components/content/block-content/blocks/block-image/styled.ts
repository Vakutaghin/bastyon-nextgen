import styled from 'vue3-styled-components'

export const SC_BlockImage = styled.figure`
  margin: 1em 0;
  text-align: center;

  /* Картинка — TorImage (под Tor заглушка вместо <img>), поэтому стили на figure. */
  img {
    max-width: 100%;
    height: auto;
    border-radius: var(--ui-radius-sm);
    display: block;
    margin: 0 auto;
  }
`

export const SC_BlockImageCaption = styled.figcaption`
  margin-top: 0.5em;
  font-size: 0.9em;
  color: var(--color-text-secondary);
  font-style: italic;
`
