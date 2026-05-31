import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

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
  ${(p: any) =>
    p.imageCount === 1 &&
    `
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
  ${(p: any) =>
    p.imageCount === 2 &&
    `
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
  ${(p: any) =>
    p.imageCount === 3 &&
    `
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
  ${(p: any) =>
    p.imageCount === 4 &&
    `
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
  ${(p: any) =>
    p.imageCount >= 5 &&
    `
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
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s ease;
  cursor: pointer;
`

export const SC_ZoomIconCircle = styled.div`
  background: ${COLORS.TEXT_MUTED};
  border-radius: 50%;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: ${COLORS.SHADOW_SM};
  pointer-events: none;

  .zoom-icon {
    font-size: 24px;
    color: ${COLORS.WHITE};
    display: flex;
    align-items: center;
    justify-content: center;
  }
`
