import styled from 'vue3-styled-components'

/** Карточка профиля или коллекции — как карточка поста (post-embed): рамка, ширина до 320px. */
export const SC_EntityCard = styled.span`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  max-width: min(320px, 100%);
  margin: 4px 0;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--ui-radius-lg);
  background: var(--color-bg-primary);
  color: var(--ui-text-highlighted);
  text-decoration: none;
  cursor: pointer;
  transition: border-color var(--transition-fast);

  &:hover {
    border-color: var(--ui-primary);
  }
`

/** Обложка коллекции; нет — значок. */
export const SC_EntityCover = styled.span`
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  overflow: hidden;
  border-radius: var(--ui-radius-md);
  background: var(--ui-bg-elevated);
  color: var(--ui-text-muted);
  font-size: 22px;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`

export const SC_EntityInfo = styled.span`
  display: flex;
  flex-direction: column;
  min-width: 0;
`

export const SC_EntityTitle = styled.span`
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 14px;
  font-weight: 500;
`

export const SC_EntityMeta = styled.span`
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--ui-text-muted);
  font-size: 12px;
`
