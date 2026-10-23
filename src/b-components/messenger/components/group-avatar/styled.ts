import styled from 'vue3-styled-components'

export const SC_GroupAvatar = styled('div', { size: Number })`
  position: relative;
  flex-shrink: 0;
  width: ${(p) => `${p.size}px`};
  height: ${(p) => `${p.size}px`};
`

/** Круг из 2–4 плиток: 2 — половинки, 3 — половинка и две четвертинки, 4 — четвертинки. */
export const SC_Mosaic = styled('div', { size: Number })`
  width: ${(p) => `${p.size}px`};
  height: ${(p) => `${p.size}px`};
  border-radius: 50%;
  overflow: hidden;
  display: grid;
  gap: 1px;
  background: var(--ui-bg);
  grid-template-columns: 1fr;
  grid-template-rows: 1fr;

  &.n2 {
    grid-template-columns: 1fr 1fr;
  }

  &.n3,
  &.n4 {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
  }

  &.n3 .t0 {
    grid-row: 1 / span 2;
  }

  /* Плитки стыкуются без скруглений: аватар ставит радиус и инлайном. */
  .ant-avatar,
  img,
  div[style] {
    border-radius: 0 !important;
  }
`

export const SC_Tile = styled.div`
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
`

export const SC_GroupBadge = styled('div', { size: Number })`
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: ${(p) => `${Math.max(16, Math.round((p.size ?? 0) * 0.36))}px`};
  height: ${(p) => `${Math.max(16, Math.round((p.size ?? 0) * 0.36))}px`};
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${(p) => `${Math.max(10, Math.round((p.size ?? 0) * 0.22))}px`};
  color: var(--ui-text-inverted);
  background: var(--ui-primary);
  box-shadow: 0 0 0 2px var(--ui-bg);
  z-index: 2;
`
