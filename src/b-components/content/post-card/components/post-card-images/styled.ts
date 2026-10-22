import styled from 'vue3-styled-components'

/** Одна картинка: во всю ширину, высота по картинке, не выше 500px и экрана
 *  под шапкой (--media-max-height): у телефона боком экран ниже 500px. */
export const SC_PostImage = styled.div`
  margin-bottom: 15px;
  border-radius: var(--ui-radius-lg);
  overflow: hidden;
  max-width: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;

  > div {
    width: 100%;
    border-radius: var(--ui-radius-lg);
  }

  img {
    width: 100%;
    max-width: 100%;
    height: auto;
    object-fit: cover;
    display: block;
    max-height: min(500px, var(--media-max-height));
    border-radius: var(--ui-radius-lg);
  }
`

/** Сетка нескольких картинок: высота — из aspect-ratio, плитки по процентам
 *  (раскладка — helpers/content/image-grid-layout). */
export const SC_ImageGrid = styled.div`
  position: relative;
  width: 100%;
  /* Предел ширины — inline (gridStyle): сетка не выше экрана под шапкой,
     пропорции те же, по центру. */
  margin: 0 auto 15px;
  border-radius: var(--ui-radius-lg);
  overflow: hidden;
`

export const SC_GridTile = styled.div`
  position: absolute;
  cursor: pointer;
`

/** Содержимое плитки; отступы до соседей задаёт inline-стиль (top/left/…). */
export const SC_GridCell = styled.div`
  position: absolute;
  overflow: hidden;
  background: var(--color-bg-tertiary);

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: filter var(--transition-quick);
  }

  &:hover img {
    filter: brightness(0.92);
  }

  /* Заглушка Tor — во всю плитку, а не своей минимальной высотой. */
  > button {
    height: 100%;
    min-height: 0;
  }
`

/** «+N» на последней плитке, когда картинок больше, чем помещается в сетку. */
export const SC_GridMore = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-overlay-50);
  color: var(--color-white);
  font-size: 28px;
  font-weight: 600;
  pointer-events: none;
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
  transition: opacity var(--transition-normal);
  cursor: pointer;
`

export const SC_ZoomIconCircle = styled.div`
  background: var(--color-text-muted);
  border-radius: 50%;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-sm);
  pointer-events: none;

  .zoom-icon {
    font-size: 24px;
    color: var(--color-white);
    display: flex;
    align-items: center;
    justify-content: center;
  }
`
