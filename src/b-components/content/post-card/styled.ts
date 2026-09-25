import styled from 'vue3-styled-components'
import Card from '@/components/card/card.vue'
import { BREAKPOINTS } from '@/styles/design-tokens'

export const SC_PostCard = styled(Card)`
  margin-bottom: 15px;

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    margin-bottom: 10px;
  }

  @media (max-width: ${BREAKPOINTS.MOBILE}) {
    margin-bottom: 8px;
  }
`

/** Метка «Продвигаемое» для бустнутых постов, вплетённых в ленту. */
export const SC_BoostedBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-brand-cyan);

  svg {
    width: 12px;
    height: 12px;
  }
`

/** Бейдж оптимистичного поста: транзакция в мемпуле, ещё не в блокчейне. */
export const SC_PendingBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 10px;
  padding: 3px 9px;
  border-radius: var(--ui-radius-lg);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: var(--color-warning-hex);
  background: var(--color-warning-bg-soft);

  svg {
    width: 12px;
    height: 12px;
  }
`

export const SC_PostHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 15px;

  @media (max-width: ${BREAKPOINTS.MOBILE}) {
    margin-bottom: 10px;
  }
`

export const SC_PostTitle = styled.h3`
  margin: 0 0 15px;
  font-size: 16px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
  line-height: 1.4;

  @media (max-width: ${BREAKPOINTS.MOBILE}) {
    margin: 0 0 10px;
    font-size: 16px;
  }
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
  font-weight: 500;
  font-size: 14px;
  color: var(--ui-text-highlighted);
`

/** Репутация — нейтральный outline-бейдж Nuxt UI. */
export const SC_PostAuthorRep = styled.div`
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

export const SC_PostActionBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: none;
  background: none;
  border-radius: var(--ui-radius-md);
  color: var(--ui-text-muted);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition:
    background-color 0.15s,
    color 0.15s;

  /* Ghost-кнопка Nuxt UI: подложка на hover, текст ярче. */
  &:hover {
    background: var(--ui-bg-elevated);
    color: var(--ui-text-highlighted);
  }

  /* На узком экране — только иконка: подпись не помещалась и обрезалась краем
     карточки. Для скринридеров остаётся aria-label. */
  @media (max-width: ${BREAKPOINTS.MOBILE}) {
    /* Иконка — тоже span (.anticon), её оставляем. */
    & > span:not(.anticon) {
      display: none;
    }
  }
`

export const SC_PostActions = styled.div`
  display: flex;
  align-items: center;
  gap: 15px;
  padding-top: 12px;
  border-top: 1px solid var(--color-border-light);

  .ant-btn {
    flex: 0 0 auto;
  }

  .ant-btn:last-child {
    margin-left: auto;
  }

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    gap: 10px;
    padding-top: 10px;
  }

  @media (max-width: ${BREAKPOINTS.MOBILE}) {
    gap: 8px;
    padding-top: 8px;
  }
`

export const SC_StarRating = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  min-height: 22px;

  .star-count {
    color: var(--color-text-primary) !important;
    font-size: 14px;
    margin-left: 7px;
  }

  .voters-count {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--color-text-secondary) !important;
    font-size: 14px;
    margin-left: 11px;

    svg {
      width: 15px;
      height: 15px;
    }
  }
`

export const SC_StarWrapper = styled.div`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  vertical-align: middle;

  .star-bg {
    font-size: 22px;
    color: var(--ui-text-dimmed) !important;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    line-height: 1;
    position: relative;
    z-index: 0;
    flex-shrink: 0;

    svg {
      width: 22px;
      height: 22px;
      display: block;
      margin: 0;
      padding: 0;
      /* Пустая звезда — приглушённый контур, как у InputRating в Nuxt UI:
         залитая полупрозрачным жёлтым она читалась как «оценено». */
      fill: none !important;
      color: var(--ui-text-dimmed) !important;
      stroke: currentcolor !important;
    }
  }
`

export const SC_StarFilled = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 1;

  .star-fill {
    font-size: 22px;
    color: var(--color-warning) !important;
    display: block;
    width: 22px;
    height: 22px;
    line-height: 1;

    svg {
      width: 22px;
      height: 22px;
      display: block;
      fill: var(--color-warning) !important;
      color: var(--color-warning) !important;
      stroke: currentcolor !important;
    }
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

export const SC_PostBookmark = styled.div`
  margin-left: auto;
  cursor: pointer;
  padding: 0 10px;
`

export const SC_PostCardYoutube = styled.div`
  margin: 12px 0;
  display: flex;
  flex-direction: column;
  gap: 12px;

  iframe {
    width: 100%;
    aspect-ratio: 16 / 9;
    border-radius: var(--ui-radius-lg);
    border: 0;
  }
`

export const SC_AuthorLinkWrap = styled.div`
  display: block;
`

/** Обёртка контента репоста: ниже шапки показывается «карточка» оригинала */
export const SC_RepostInnerCard = styled.div`
  margin-top: 8px;
  padding: 12px 14px;
  background: rgb(var(--ui-bg-elevated-rgb) / 50%);
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-lg);
`

/** Блок «автор оригинала» внутри карточки репоста: аватар, имя, дата — как в шапке поста */
export const SC_RepostOriginalAuthor = styled.div`
  display: flex;
  align-items: center;
  gap: 11px;
  margin-bottom: 12px;

  a {
    border: 0;
  }
`

export const SC_RepostOriginalAuthorInfo = styled.div`
  display: flex;
  flex-direction: column;
`

export const SC_RepostOriginalAuthorName = styled.div`
  font-weight: 500;
  font-size: 14px;
  color: var(--ui-text-highlighted);

  a {
    color: inherit;
    text-decoration: none;

    &:hover {
      color: var(--ui-primary);
      text-decoration: none;
    }
  }
`

export const SC_RepostOriginalAuthorTime = styled.time`
  font-size: 12px;
  color: var(--ui-text-muted);
  margin-top: 2px;
`

/** Блок «Публикация удалена» для репоста с deleted */
export const SC_RepostDeleted = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 0;
  font-size: 14px;
  color: var(--color-text-secondary);

  .repost-deleted-icon {
    color: var(--color-text-primary);
    font-size: 18px;
    flex-shrink: 0;
  }
`
