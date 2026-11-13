import styled from 'vue3-styled-components'

// Линейная полоса: подложка bg-elevated, заполнение акцентом, скруглённые
// концы, толщина 8 / 6px — как было у antd Progress. «В работе» — блик по
// заполнению (@keyframes ui-progress-active в style.css), без него при
// «уменьшить движение».
//
// Место в раскладке тоже как у antd: строка 22px (у маленькой 19px) и отступ
// 8px снизу и справа — вёрстка вокруг полос рассчитана на него.
//
// Части для styled родителя: .ui-progress, __track, __fill, __info.
// Переменные: --ui-progress-color, --ui-progress-track, --ui-progress-height.
export const SC_Progress = styled.div`
  --ui-progress-height: 8px;

  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 22px;
  margin: 0 8px 8px 0;
  font-size: 14px;
  line-height: 22px;

  &[data-size='small'] {
    --ui-progress-height: 6px;

    min-height: 19px;
    font-size: 12px;
  }

  .ui-progress__track {
    position: relative;
    flex: 1 1 auto;
    height: var(--ui-progress-height);
    overflow: hidden;
    border-radius: var(--ui-radius-full);
    background: var(--ui-progress-track, var(--ui-bg-elevated));
  }

  .ui-progress__fill {
    position: relative;
    display: block;
    width: 0;
    height: 100%;
    border-radius: var(--ui-radius-full);
    background: var(--ui-progress-color, var(--ui-primary));
    transition: width var(--transition-normal);
  }

  &[data-status='active'] .ui-progress__fill::before {
    position: absolute;
    inset: 0 auto 0 0;
    border-radius: var(--ui-radius-full);
    background: var(--ui-bg);
    opacity: 0;
    animation: ui-progress-active 2.4s cubic-bezier(0.23, 1, 0.32, 1) infinite;
    content: '';
  }

  @media (prefers-reduced-motion: reduce) {
    .ui-progress__fill {
      transition: none;
    }

    &[data-status='active'] .ui-progress__fill::before {
      animation: none;
    }
  }

  .ui-progress__info {
    flex: 0 0 auto;
    min-width: 2em;
    color: var(--ui-text);
    text-align: left;
    white-space: nowrap;
  }
`
