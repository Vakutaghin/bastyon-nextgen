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

export const SC_ImageWrapper = styled.div`
  position: relative;
  cursor: pointer;
  overflow: hidden;

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &:hover {
    .image-overlay {
      opacity: 1;
    }
  }
`

export const SC_ImageOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s ease;
  cursor: pointer;
`

export const SC_ZoomIconCircle = styled.div`
  background: rgba(128, 128, 128, 0.7);
  border-radius: 50%;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  pointer-events: none;

  .zoom-icon {
    font-size: 24px;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
  }
`

export const SC_PostImage = styled.div`
  margin-bottom: 15px;
  border-radius: 8px;
  overflow: hidden;
  max-width: 100%;
  width: 100%;
  display: flex;
  gap: 2px;
  box-sizing: border-box;

  /* 1 изображение */
  ${(p: any) => p.imageCount === 1 && `
    flex-direction: column;
    gap: 0;

    > div {
      width: 100%;
      border-radius: 8px;
    }

    img {
      width: 100%;
      max-width: 100%;
      height: auto;
      object-fit: cover;
      display: block;
      max-height: 500px;
      border-radius: 8px;
    }
  `}

  /* 2 изображения - splitscreen */
  ${(p: any) => p.imageCount === 2 && `
    flex-direction: row;
    gap: 2px;

    > div {
      flex: 1;
      width: calc(50% - 1px);
      max-width: calc(50% - 1px);
      max-height: 500px;
    }

    > div:first-child {
      border-radius: 8px 0 0 8px;
    }

    > div:last-child {
      border-radius: 0 8px 8px 0;
    }

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      box-sizing: border-box;
    }
  `}

  /* 3 изображения - левая половина, правая половина с двумя по вертикали */
  ${(p: any) => p.imageCount === 3 && `
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
    gap: 2px;
    max-height: 500px;
    width: 100%;
    box-sizing: border-box;

    > div:first-child {
      grid-column: 1;
      grid-row: 1 / 3;
      border-radius: 8px 0 0 8px;
    }

    > div:nth-child(2) {
      grid-column: 2;
      grid-row: 1;
      border-radius: 0 8px 0 0;
    }

    > div:nth-child(3) {
      grid-column: 2;
      grid-row: 2;
      border-radius: 0 0 8px 0;
    }

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      box-sizing: border-box;
    }
  `}

  /* 4 изображения - по 2 в строке */
  ${(p: any) => p.imageCount === 4 && `
    flex-wrap: wrap;
    flex-direction: row;
    gap: 2px;

    > div {
      width: calc(50% - 1px);
      max-width: calc(50% - 1px);
      max-height: 250px;
      flex: 0 0 calc(50% - 1px);
    }

    > div:nth-child(1) {
      border-radius: 8px 0 0 0;
    }

    > div:nth-child(2) {
      border-radius: 0 8px 0 0;
    }

    > div:nth-child(3) {
      border-radius: 0 0 0 8px;
    }

    > div:nth-child(4) {
      border-radius: 0 0 8px 0;
    }

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      box-sizing: border-box;
    }
  `}

  /* 5 и более изображений - 2 в верхней строке, 3 в нижней */
  ${(p: any) => p.imageCount >= 5 && `
    flex-wrap: wrap;
    flex-direction: row;
    gap: 2px;

    > div {
      max-height: 250px;
    }

    > div:nth-child(1),
    > div:nth-child(2) {
      width: calc(50% - 1px);
      max-width: calc(50% - 1px);
      flex: 0 0 calc(50% - 1px);
    }

    > div:nth-child(1) {
      border-radius: 8px 0 0 0;
    }

    > div:nth-child(2) {
      border-radius: 0 8px 0 0;
    }

    > div:nth-child(3),
    > div:nth-child(4),
    > div:nth-child(5) {
      width: calc(33.333% - 1.33px);
      max-width: calc(33.333% - 1.33px);
      flex: 0 0 calc(33.333% - 1.33px);
    }

    > div:nth-child(3) {
      border-radius: 0 0 0 8px;
    }

    > div:nth-child(5) {
      border-radius: 0 0 8px 0;
    }

    /* Если больше 5, скрываем остальные */
    > div:nth-child(n+6) {
      display: none;
    }

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      box-sizing: border-box;
    }
  `}
`

export const SC_VideoPlaceholder = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: linear-gradient(135deg, rgba(206, 212, 218, 0.3) 0%, rgba(206, 212, 218, 0.5) 100%);
  border-radius: 8px;
  margin-bottom: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px dashed rgba(206, 212, 218, 0.6);

  .video-icon {
    font-size: 60px;
    color: rgba(33, 37, 41, 0.4);
  }
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
  margin-left: 8px;
  font-weight: 500;
  font-size: 14px;
  position: relative;
  top: -7px;
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

  a {
    border-bottom: 0;
  }
`

export const SC_PostContent = styled.div`
  margin-bottom: 15px;
  line-height: 1.6;
  color: rgb(33, 37, 41) !important;
  word-wrap: break-word;
  overflow-wrap: break-word;
  word-break: break-word;

  p {
    margin: 0;
    color: rgb(33, 37, 41) !important;
    word-wrap: break-word;
    overflow-wrap: break-word;
    word-break: break-word;
  }

  :deep(*) {
    color: rgb(33, 37, 41) !important;
  }

  :deep(p) {
    color: rgb(33, 37, 41) !important;
  }

  :deep(div) {
    color: rgb(33, 37, 41) !important;
  }

  :deep(span) {
    color: rgb(33, 37, 41) !important;
  }

  :deep(.bastyon-link) {
    color: rgb(0, 123, 255) !important;
    text-decoration: underline;
    cursor: pointer;
    word-break: break-all;
    overflow-wrap: break-word;
    word-wrap: break-word;
  }

  :deep(.bastyon-link:hover) {
    color: rgb(0, 86, 179) !important;
    text-decoration: underline;
  }
`

export const SC_PostPreview = styled.div`
  position: relative;
  overflow: hidden;
  word-wrap: break-word;
  overflow-wrap: break-word;
  word-break: break-word;

  p {
    margin: 0 0 7.50px 0;
    color: rgb(33, 37, 41) !important;

    &:last-child {
      margin-bottom: 0;
    }
  }

  :deep(.bastyon-link) {
    color: rgb(0, 123, 255) !important;
    text-decoration: underline;
    cursor: pointer;
    word-break: break-all;
    overflow-wrap: break-word;
    word-wrap: break-word;
  }

  :deep(.bastyon-link:hover) {
    color: rgb(0, 86, 179) !important;
    text-decoration: underline;
  }
`

export const SC_PostCategoriesAndTags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-bottom: 15px;
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

export const SC_CommentsPreview = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  margin-top: 12px;
  border-top: 1px solid rgba(206, 212, 218, 0.5);
  padding-top: 12px;
`

export const SC_CommentItem = styled.div`
  display: flex;
  gap: 10px;
  align-items: flex-start;

  a {
    border-bottom: 0;
    text-decoration: none;
    color: inherit;
  }

  .comment-avatar,
  .comment-avatar-placeholder {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
    background: rgb(222, 226, 230);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .comment-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .comment-avatar-placeholder {
    color: rgb(33, 37, 41);
    font-weight: 600;
    font-size: 13px;
  }
`

export const SC_CommentAuthor = styled.div`
  font-weight: 600;
  font-size: 13px;
  color: rgb(33, 37, 41);
`

export const SC_CommentText = styled.div`
  font-size: 14px;
  color: rgb(33, 37, 41) !important;
  line-height: 1.5;
  word-wrap: break-word;
  overflow-wrap: break-word;
  word-break: break-word;

  :deep(.bastyon-link) {
    color: rgb(0, 123, 255) !important;
    text-decoration: underline;
    cursor: pointer;
    word-break: break-all;
    overflow-wrap: break-word;
    word-wrap: break-word;
  }

  a {
    border-bottom: 1px solid rgb(0, 123, 255);
  }
`

export const SC_CommentAvatar = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: rgb(222, 226, 230);
  display: flex;
  align-items: center;
  justify-content: center;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
`

export const SC_CommentAvatarPlaceholder = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: rgb(222, 226, 230);
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgb(33, 37, 41);
  font-weight: 600;
  font-size: 13px;
`

export const SC_CommentContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
`

export const SC_CommentMeta = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;

  a {
    border-bottom: 0;
    text-decoration: none;
    color: inherit;
  }
`

export const SC_CommentDate = styled.div`
  font-size: 12px;
  color: rgb(108, 117, 125);
`

export const SC_CommentActions = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 2px;

  span {
    font-size: 14px;
    color: rgb(108, 117, 125);
    cursor: pointer;
    user-select: none;
  }
`
