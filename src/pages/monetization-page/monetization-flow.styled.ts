import styled from 'vue3-styled-components'
import { BREAKPOINTS } from '@/styles/design-tokens'

/* Цвет шага задаёт класс: свой оттенок у рекламодателя, рекламы, читателей и выплаты. */
const STEP_TINTS = `
  &.advertiser { --step-rgb: var(--ui-violet-rgb); }
  &.boost { --step-rgb: var(--ui-amber-rgb); }
  &.readers { --step-rgb: var(--ui-info-rgb); }
  &.payout { --step-rgb: var(--ui-success-rgb); }
`

export const SC_Flow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-2xl);
  background: var(--ui-bg);

  @media (max-width: ${() => BREAKPOINTS.MOBILE}) {
    padding: 16px;
  }
`

/*
 * Четыре шага в ряд со стрелками между ними; уже экрана компьютера — столбиком,
 * стрелки вниз. Стрелка — псевдоэлемент шага: в <ol> не может быть ничего,
 * кроме <li>.
 */
export const SC_Steps = styled.ol`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 28px;
  margin: 0;
  padding: 0;
  list-style: none;

  @media (max-width: ${() => BREAKPOINTS.DESKTOP}) {
    grid-template-columns: minmax(0, 1fr);
    gap: 26px;
  }
`

export const SC_Step = styled.li`
  ${() => STEP_TINTS}
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  padding: 18px 16px;
  border: 1px solid rgb(var(--step-rgb) / 28%);
  border-radius: var(--ui-radius-xl);
  background: rgb(var(--step-rgb) / 7%);

  &:not(:last-child)::after {
    content: '';
    position: absolute;
    top: 50%;
    right: -19px;
    width: 10px;
    height: 10px;
    border-top: 2px solid var(--ui-border-accented);
    border-right: 2px solid var(--ui-border-accented);
    transform: translateY(-50%) rotate(45deg);
  }

  @media (max-width: ${() => BREAKPOINTS.DESKTOP}) {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-rows: auto auto;
    gap: 2px 14px;
    align-items: center;
    padding: 14px 16px;

    &:not(:last-child)::after {
      inset: auto auto -19px 50%;
      transform: translateX(-50%) rotate(135deg);
    }
  }
`

export const SC_StepIcon = styled.span`
  ${() => STEP_TINTS}
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  font-size: 20px;
  color: rgb(var(--step-rgb));
  background: rgb(var(--step-rgb) / 16%);

  @media (max-width: ${() => BREAKPOINTS.DESKTOP}) {
    grid-row: 1 / span 2;
  }
`

export const SC_StepNumber = styled.span`
  ${() => STEP_TINTS}
  position: absolute;
  top: 12px;
  right: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  border-radius: var(--ui-radius-full);
  font-size: 12px;
  font-weight: 600;
  color: rgb(var(--step-rgb));
  border: 1px solid rgb(var(--step-rgb) / 40%);
`

export const SC_StepTitle = styled.span`
  font-size: 15px;
  font-weight: 600;
  color: var(--ui-text-highlighted);

  @media (max-width: ${() => BREAKPOINTS.DESKTOP}) {
    padding-right: 28px;
  }
`

export const SC_StepText = styled.span`
  font-size: 14px;
  line-height: 1.5;
  color: var(--ui-text-toned);

  @media (max-width: ${() => BREAKPOINTS.DESKTOP}) {
    grid-column: 2;
  }
`

/* Замыкание круга: монеты автора уходят на биржу и снова к рекламодателям. */
export const SC_Loop = styled.p`
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0;
  padding: 12px 16px;
  border: 1px dashed var(--ui-border-accented);
  border-radius: var(--ui-radius-lg);
  font-size: 14px;
  line-height: 1.5;
  color: var(--ui-text-toned);
`

export const SC_LoopIcon = styled.span`
  display: inline-flex;
  flex: 0 0 auto;
  font-size: 18px;
  color: var(--ui-success);
`
