import styled from 'vue3-styled-components'

// Громкость — как у YouTube: значок, а при наведении на него выезжает
// ползунок. На телефоне громкости в плеере нет: её меняют кнопками телефона.

export const SC_VolumeArea = styled.div`
  display: flex;
  align-items: center;
  height: 100%;

  .touch-ui & {
    display: none;
  }
`

/** Ползунок: скрыт, пока курсор не над значком звука, и пока его не тянут. */
export const SC_VolumePanel = styled.div`
  position: relative;
  width: 0;
  height: 100%;
  overflow: hidden;
  cursor: pointer;
  transition:
    width var(--transition-player),
    margin var(--transition-player);

  .volume-area:hover &,
  .volume-area.dragging &,
  .volume-area:focus-within & {
    width: 52px;
    margin-right: 3px;
  }

  .is-fullscreen .volume-area:hover &,
  .is-fullscreen .volume-area.dragging & {
    width: 78px;
  }
`

/** Зона нажатия — по ширине дорожки: громкость считается от её краёв. */
export const SC_VolumeHit = styled.div`
  position: absolute;
  inset: 0 6px;
`

export const SC_VolumeTrack = styled.div`
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 3px;
  margin-top: -1.5px;
  background: rgb(var(--color-white-rgb) / 20%);
`

export const SC_VolumeFill = styled.div`
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: var(--volume);
  background: var(--color-white);
`

export const SC_VolumeKnob = styled.div`
  position: absolute;
  left: var(--volume);
  top: 50%;
  width: 12px;
  height: 12px;
  margin: -6px 0 0 -6px;
  border-radius: 50%;
  background: var(--color-white);
`
