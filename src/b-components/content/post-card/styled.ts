import styled from 'vue3-styled-components'
import Card from '@/components/card/card.vue'
import { BREAKPOINTS } from '@/styles/design-tokens'

export const SC_PostCard = styled(Card)`
  margin-bottom: 15px;

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    margin-bottom: 10px;
  }

  /* Телефон: пост во всю ширину экрана, как в Instagram, — поверх полей
     страницы (--page-gutter задают страницы с лентой). Рамку и отступы тела
     карточки снимает style.css: до .ant-card-body отсюда не дотянуться. */
  @media (max-width: ${BREAKPOINTS.MOBILE}) {
    margin-bottom: 0;
    margin-inline: calc(-1 * var(--page-gutter, 0px));
  }
`

/** Картинки и ролик поста: на телефоне — от края до края карточки (--post-bleed). */
export const SC_PostMedia = styled.div`
  margin-inline: calc(-1 * var(--post-bleed, 0px));
`

/** Метка «Продвигаемое» для бустнутых постов, вплетённых в ленту. */
export const SC_BoostedBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--ui-primary);

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

/** Пометка «Для подписчиков» и т. п. — у поста с ограниченной видимостью. */
export const SC_VisibilityBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--ui-text-muted);

  svg {
    width: 12px;
    height: 12px;
  }
`

/** Заглушка вместо поста, который автор открыл не этому читателю. */
export const SC_RestrictedNotice = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 14px 16px;
  border-radius: var(--ui-radius-md);
  font-size: 14px;
  line-height: calc(1.5 * var(--leading-scale));
  color: var(--ui-text-muted);
  background: var(--ui-bg-elevated);

  svg {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    margin-top: 3px;
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
  line-height: calc(1.4 * var(--leading-scale));

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
    background-color var(--transition-quick),
    color var(--transition-quick);

  /* Ghost-кнопка Nuxt UI: подложка на hover, текст ярче. */
  &:hover {
    background: var(--ui-bg-elevated);
    color: var(--ui-text-highlighted);
  }

  /* В узкой карточке — только иконка: правило в style.css (.post-actions). */
`

export const SC_PostActions = styled.div`
  display: flex;
  align-items: center;
  /* Своих кнопок у поста бывает больше (изменить, удалить) — лишнее уходит на
     вторую строку, а не за край. */
  flex-wrap: wrap;
  gap: 4px 15px;
  padding-top: 12px;
  border-top: 1px solid var(--color-border-light);
  /* Контейнер для правила подписей в style.css: stylis 3 @container выбрасывает. */
  container: post-actions / inline-size;

  .ant-btn {
    flex: 0 0 auto;
  }

  .ant-btn:last-child {
    margin-left: auto;
  }

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    column-gap: 10px;
    padding-top: 10px;
  }

  @media (max-width: ${BREAKPOINTS.MOBILE}) {
    column-gap: 8px;
    padding-top: 8px;
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
    color: var(--ui-primary);
    background: rgb(var(--ui-primary-rgb) / 12%);
  }
`

export const SC_PostBookmark = styled.div`
  margin-left: auto;
  cursor: pointer;
  padding: 0 10px;
`

export const SC_PostCardYoutube = styled.div`
  margin: 12px calc(-1 * var(--post-bleed, 0px));
  display: flex;
  flex-direction: column;
  gap: 12px;

  iframe {
    width: 100%;
    aspect-ratio: 16 / 9;
    /* Не выше экрана под шапкой — телефон боком. */
    max-width: calc(var(--media-max-height) * 16 / 9);
    align-self: center;
    border-radius: var(--post-media-radius, var(--ui-radius-lg));
    border: 0;
  }
`

/**
 * Превью ролика YouTube там, где плеер не встраивается (страница `tauri://`,
 * «Ошибка 153»): картинка ролика и кнопка, ссылка открывается в браузере.
 */
export const SC_VideoEmbedLink = styled.a`
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  max-width: calc(var(--media-max-height) * 16 / 9);
  align-self: center;
  overflow: hidden;
  border-radius: var(--post-media-radius, var(--ui-radius-lg));
  background: var(--color-black);
  cursor: pointer;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`

export const SC_VideoEmbedLinkLabel = styled.span`
  position: absolute;
  top: 50%;
  left: 50%;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: var(--ui-radius-lg);
  background: var(--color-overlay-65);
  color: var(--color-white);
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;
  transform: translate(-50%, -50%);
`

export const SC_AuthorLinkWrap = styled.div`
  display: block;
`

/** Обёртка контента репоста: ниже шапки показывается «карточка» оригинала */
export const SC_RepostInnerCard = styled.div`
  /* Внутри рамки репоста картинки не растягиваются до краёв экрана. */
  --post-bleed: 0px;
  --post-media-radius: var(--ui-radius-lg);

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
