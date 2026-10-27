import styled from 'vue3-styled-components'

/** «Информация»: «О себе», адрес, сайт, публикации, дата регистрации. */
export const SC_UserAbout = styled.div`
  font-size: 14px;
  color: var(--color-text-primary);
  line-height: calc(1.5 * var(--leading-scale));
  white-space: pre-wrap;
  word-break: break-word;

  a {
    color: var(--ui-primary);
    text-decoration: none;

    &:hover {
      text-decoration: none;
      opacity: 0.8;
    }
  }
`

export const SC_UserAddress = styled.div`
  font-size: 12px;
  color: var(--ui-text-dimmed);
  word-break: break-all;
  display: flex;
  align-items: center;
  cursor: pointer;
  margin-top: 10px;
`

export const SC_ExplorerLinkRow = styled.div`
  margin-top: 4px;
  margin-bottom: 8px;
`

export const SC_ExplorerLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--color-primary);
  text-decoration: none;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
`

export const SC_UserSite = styled.a`
  font-size: 14px;
  color: var(--ui-primary);
  text-decoration: none;
  word-break: break-all;
  display: flex;
  align-items: center;
  border: 0;

  &:hover {
    text-decoration: underline;
  }
`
