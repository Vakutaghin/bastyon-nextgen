import styled from 'vue3-styled-components'

/** Цвет вида узла на графе и в легенде — токены темы. */
const KIND_COLORS = `
  .self { --net-color: var(--ui-primary); }
  .interface { --net-color: var(--ui-text-highlighted); }
  .transport { --net-color: var(--ui-text-muted); }
  .delivery { --net-color: var(--ui-success); }
  .nomadnetwork { --net-color: var(--ui-warning); }
  .propagation { --net-color: var(--ui-error); }
  .unknown { --net-color: var(--ui-text-dimmed); }
`

export const SC_NetGraph = styled.div`
  width: 100%;
  max-width: 560px;
  margin: 0 auto;

  svg {
    display: block;
    width: 100%;
    height: auto;
  }

  ${() => KIND_COLORS}

  .edge {
    stroke: var(--ui-border);
    stroke-width: 1.2;
  }

  .ring {
    fill: none;
    stroke: var(--ui-border);
    stroke-width: 1;
    stroke-dasharray: 3 5;
  }

  .ring-label {
    font-size: 10px;
    fill: var(--ui-text-dimmed);
  }

  .node circle {
    fill: var(--net-color);
    stroke: var(--ui-bg);
    stroke-width: 1.5;
  }

  .node.interface circle {
    fill: var(--ui-bg);
    stroke: var(--net-color);
    stroke-width: 2;
  }

  .node.offline circle {
    stroke-dasharray: 2 2;
    opacity: 0.5;
  }

  .node text {
    font-size: 12px;
    fill: var(--ui-text-muted);
    text-anchor: middle;
    pointer-events: none;
  }

  .node.self text,
  .node.interface text {
    font-weight: 600;
    fill: var(--ui-text-highlighted);
  }
`

export const SC_NetLegend = styled.ul`
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 12px;
  color: var(--ui-text-muted);

  ${() => KIND_COLORS}

  li {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  li::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: var(--ui-radius-full);
    background: var(--net-color);
  }
`
