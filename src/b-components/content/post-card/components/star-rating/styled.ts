import styled from 'vue3-styled-components'

export const SC_InlineBlock = styled.div`
  display: inline-block;
`

export const SC_AuthPopoverContent = styled.div`
  text-align: center;
  max-width: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;

  p {
    margin: 0;
    font-size: 13px;
    line-height: 1.4;
  }
`

export const SC_StarRating = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  min-height: 22px;

  .star-count {
    color: var(--color-text-primary) !important;
    font-size: 15px;
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
  cursor: pointer;
  transition: transform 0.1s ease;

  &:hover {
    transform: scale(1.1);
  }

  &:active {
    transform: scale(0.95);
  }

  &.disabled {
    cursor: not-allowed;
    opacity: 0.6;

    &:hover {
      transform: none;
    }
  }

  &.readonly {
    cursor: default;

    &:hover {
      transform: none;
    }
  }

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
