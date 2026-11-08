import styled from 'vue3-styled-components'

export const SC_BlockImage = styled.figure`
  margin: 1em 0;
  text-align: center;

  /* Картинка — TorImage, поэтому стили на figure. */
  img {
    max-width: 100%;
    height: auto;
    border-radius: var(--ui-radius-sm);
    display: block;
    margin: 0 auto;
  }
`

/** Картинка-кнопка: нажатие открывает просмотрщик. */
export const SC_BlockImageButton = styled.button`
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  background: none;
  cursor: zoom-in;

  &:focus-visible {
    outline: 2px solid var(--ui-primary);
    outline-offset: 2px;
    border-radius: var(--ui-radius-sm);
  }
`

export const SC_BlockImageCaption = styled.figcaption`
  margin-top: 0.5em;
  font-size: 0.9em;
  color: var(--color-text-secondary);
  font-style: italic;
`
