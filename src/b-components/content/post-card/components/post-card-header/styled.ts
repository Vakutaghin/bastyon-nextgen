import styled from 'vue3-styled-components'

export const SC_PostHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 15px;
`

export const SC_PostAuthor = styled.div`
  display: flex;
  align-items: center;
  gap: 11px;

  a {
    border: 0;
  }
`

export const SC_PostAuthorInfo = styled.div`
  display: flex;
  flex-direction: column;
`

export const SC_PostAuthorName = styled.div`
  font-weight: 600;
  font-size: 14px;
  color: var(--ui-text-highlighted);
`

export const SC_PostAuthorRep = styled.div`
  /* Нейтральный outline-бейдж Nuxt UI. */
  color: var(--ui-text);
  border: 1px solid var(--ui-border-accented);
  border-radius: var(--ui-radius-md);
  padding: 1px 6px;
  line-height: 16px;
  font-weight: 500;
  font-size: 12px;
`

export const SC_PostTime = styled.time`
  font-size: 12px;
  color: var(--ui-text-muted);
  margin-top: 2px;
`

export const SC_AuthorNameRow = styled.div`
  display: flex;
  align-items: center;
  text-decoration: none;
  gap: 8px;

  a {
    border-bottom: 0;
  }
`

export const SC_ChatBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  margin: 0;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  border-radius: var(--ui-radius-sm);
  line-height: 1;

  &:hover {
    color: var(--color-brand-cyan);
    background: var(--color-brand-cyan-light);
  }
`

export const SC_FollowBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  margin: 0;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  border-radius: var(--ui-radius-sm);
  line-height: 1;

  &:hover {
    color: var(--color-brand-cyan);
    background: var(--color-brand-cyan-light);
  }

  &.following {
    color: var(--color-brand-cyan);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .anticon {
    font-size: 16px;
  }
`

export const SC_DonateBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  margin: 0;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  border-radius: var(--ui-radius-sm);
  line-height: 1;

  &:hover {
    color: var(--color-brand-cyan);
    background: var(--color-brand-cyan-light);
  }

  .anticon {
    font-size: 16px;
  }
`

export const SC_PostBookmark = styled.div`
  margin-left: auto;
  cursor: pointer;
  padding: 0 10px;
`

export const SC_AuthorLinkWrap = styled.div`
  display: block;
`

export const SC_RepostLine = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  font-size: 12px;
  color: var(--color-text-secondary);

  .repost-icon {
    font-size: 12px;
    color: var(--color-text-secondary);
  }

  .repost-text {
    font-weight: 500;
  }

  .repost-from {
    color: var(--color-text-secondary);
  }

  .repost-author {
    color: var(--color-brand-cyan);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  .repost-record {
    color: var(--color-text-secondary);
  }
`
