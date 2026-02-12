import styled from 'vue3-styled-components'
import Card from '@/components/card/card.vue'

export const SC_PostCard = styled(Card)`
  margin-bottom: 15px;
`

export const SC_PostHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 15px;
`

export const SC_PostTitle = styled.h3`
  margin: 0 0 15px 0;
  font-size: 16px;
  font-weight: 600;
  color: rgb(33, 37, 41);
  line-height: 1.4;
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
  color: rgb(33, 37, 41);
`

export const SC_PostAuthorRep = styled.div`
  color: rgb(108, 117, 125);
  border: 1px solid rgb(222, 226, 230);
  border-radius: 6px;
  padding: 0 6px;
  line-height: 1.4;
  font-weight: 500;
  font-size: 14px;
`

export const SC_PostTime = styled.time`
  font-size: 11px;
  color: rgb(108, 117, 125);
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

export const SC_PostActions = styled.div`
  display: flex;
  align-items: center;
  gap: 15px;
  padding-top: 12px;
  border-top: 1px solid rgba(206, 212, 218, 0.5);

  :deep(.ant-btn) {
    flex: 0 0 auto;
  }

  :deep(.ant-btn:last-child) {
    margin-left: auto;
  }
`

export const SC_StarRating = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  min-height: 22px;

  .star-count {
    color: rgb(33, 37, 41) !important;
    font-size: 15px;
    margin-left: 7px;
  }

  .voters-count {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: rgba(33, 37, 41, 0.7) !important;
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
    color: rgba(255, 193, 7, 0.3) !important;
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
      fill: rgba(255, 193, 7, 0.3) !important;
      color: rgba(255, 193, 7, 0.3) !important;
      stroke: rgba(255, 193, 7, 0.3) !important;
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
    color: rgb(255, 193, 7) !important;
    display: block;
    width: 22px;
    height: 22px;
    line-height: 1;

    :deep(svg) {
      width: 22px;
      height: 22px;
      display: block;
      fill: rgb(255, 193, 7) !important;
      color: rgb(255, 193, 7) !important;
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
    color: rgb(255, 193, 7) !important;
    display: block;
    width: 22px;
    height: 22px;
    line-height: 1;

    :deep(svg) {
      width: 22px;
      height: 22px;
      display: block;
      fill: rgb(255, 193, 7) !important;
      color: rgb(255, 193, 7) !important;
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
  color: rgba(0, 0, 0, 0.45);
  cursor: pointer;
  border-radius: 4px;
  line-height: 1;

  &:hover {
    color: #00a4ff;
    background: rgba(0, 164, 255, 0.08);
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
  background: rgba(0, 0, 0, 0.03);
  border: 1px solid rgba(0, 0, 0, 0.08);
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
  color: rgb(33, 37, 41);

  a {
    color: inherit;
    text-decoration: none;
    &:hover {
      color: #00a4ff;
      text-decoration: underline;
    }
  }
`

export const SC_RepostOriginalAuthorTime = styled.time`
  font-size: 11px;
  color: rgb(108, 117, 125);
  margin-top: 2px;
`

/** Блок «Публикация удалена» для репоста с deleted */
export const SC_RepostDeleted = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 0;
  font-size: 14px;
  color: rgb(108, 117, 125);

  .repost-deleted-icon {
    color: rgb(33, 37, 41);
    font-size: 18px;
    flex-shrink: 0;
  }
`
