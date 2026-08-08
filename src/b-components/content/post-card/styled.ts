import styled from 'vue3-styled-components'
import Card from '@/components/card/card.vue'
import { COLORS } from '@/styles/theme-colors'
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
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: ${COLORS.BRAND_CYAN};

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
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: ${COLORS.WARNING_HEX};
  background: ${COLORS.WARNING_BG_SOFT};

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
  color: ${COLORS.TEXT_PRIMARY};
  line-height: 1.4;

  @media (max-width: ${BREAKPOINTS.MOBILE}) {
    margin: 0 0 10px;
    font-size: 15px;
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
  font-weight: 600;
  font-size: 14px;
  color: ${COLORS.TEXT_PRIMARY};
`

export const SC_PostAuthorRep = styled.div`
  color: ${COLORS.TEXT_SECONDARY};
  border: 1px solid ${COLORS.BORDER_DARK};
  border-radius: 6px;
  padding: 0 6px;
  line-height: 1.4;
  font-weight: 500;
  font-size: 14px;
`

export const SC_PostTime = styled.time`
  font-size: 11px;
  color: ${COLORS.TEXT_SECONDARY};
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
  padding: 4px 8px;
  border: none;
  background: none;
  border-radius: 8px;
  color: ${COLORS.TEXT_SECONDARY};
  cursor: pointer;
  font-size: 13px;
  transition:
    background-color 0.2s,
    color 0.2s;

  &:hover {
    background: ${COLORS.BG_HOVER};
    color: ${COLORS.PRIMARY};
  }
`

export const SC_PostActions = styled.div`
  display: flex;
  align-items: center;
  gap: 15px;
  padding-top: 12px;
  border-top: 1px solid ${COLORS.BORDER_LIGHT};

  :deep(.ant-btn) {
    flex: 0 0 auto;
  }

  :deep(.ant-btn:last-child) {
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
    color: ${COLORS.TEXT_PRIMARY} !important;
    font-size: 15px;
    margin-left: 7px;
  }

  .voters-count {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: ${COLORS.TEXT_SECONDARY} !important;
    font-size: 14px;
    margin-left: 11px;

    :deep(svg) {
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
    color: ${COLORS.WARNING_TRACK} !important;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    line-height: 1;
    position: relative;
    z-index: 0;
    flex-shrink: 0;

    :deep(svg) {
      width: 22px;
      height: 22px;
      display: block;
      margin: 0;
      padding: 0;
      fill: ${COLORS.WARNING_TRACK} !important;
      color: ${COLORS.WARNING_TRACK} !important;
      stroke: ${COLORS.WARNING_TRACK} !important;
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
    color: ${COLORS.WARNING} !important;
    display: block;
    width: 22px;
    height: 22px;
    line-height: 1;

    :deep(svg) {
      width: 22px;
      height: 22px;
      display: block;
      fill: ${COLORS.WARNING} !important;
      color: ${COLORS.WARNING} !important;
      stroke: none !important;
    }
  }
`

export const SC_StarPartial = styled.div`
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
    color: ${COLORS.WARNING} !important;
    display: block;
    width: 22px;
    height: 22px;
    line-height: 1;

    :deep(svg) {
      width: 22px;
      height: 22px;
      display: block;
      fill: ${COLORS.WARNING} !important;
      color: ${COLORS.WARNING} !important;
      stroke: none !important;
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
  color: ${COLORS.TEXT_SECONDARY};
  cursor: pointer;
  border-radius: 4px;
  line-height: 1;

  &:hover {
    color: ${COLORS.BRAND_CYAN};
    background: ${COLORS.BRAND_CYAN_LIGHT};
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
    border-radius: 8px;
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
  background: ${COLORS.OVERLAY_3};
  border: 1px solid ${COLORS.OVERLAY_8};
  border-radius: 10px;
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
  font-weight: 600;
  font-size: 14px;
  color: ${COLORS.TEXT_PRIMARY};

  a {
    color: inherit;
    text-decoration: none;

    &:hover {
      color: ${COLORS.BRAND_CYAN};
      text-decoration: underline;
    }
  }
`

export const SC_RepostOriginalAuthorTime = styled.time`
  font-size: 11px;
  color: ${COLORS.TEXT_SECONDARY};
  margin-top: 2px;
`

/** Блок «Публикация удалена» для репоста с deleted */
export const SC_RepostDeleted = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 0;
  font-size: 14px;
  color: ${COLORS.TEXT_SECONDARY};

  .repost-deleted-icon {
    color: ${COLORS.TEXT_PRIMARY};
    font-size: 18px;
    flex-shrink: 0;
  }
`
