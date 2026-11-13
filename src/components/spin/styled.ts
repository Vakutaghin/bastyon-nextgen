import styled from 'vue3-styled-components'

// Значок загрузки: круг акцентом, подпись приглушённая под ним — как было у
// antd Spin. Размер значка — `--ui-spin-size` (по data-size), свой значок из
// слота #indicator задаёт размер сам.
//
// Части для styled родителя: .ui-spin, .ui-spin__indicator, .ui-spin__tip.
export const SC_Spin = styled.div`
  --ui-spin-size: 20px;

  display: inline-flex;
  flex-direction: column;
  align-items: center;
  color: var(--ui-primary);
  text-align: center;
  vertical-align: middle;

  &[data-size='small'] {
    --ui-spin-size: 14px;
  }

  &[data-size='large'] {
    --ui-spin-size: 32px;
  }

  .ui-spin__indicator {
    display: inline-flex;
    font-size: var(--ui-spin-size);
    line-height: 1;
  }

  .ui-spin__tip {
    padding-top: 5px;
    color: var(--ui-text-muted);
    font-size: 14px;
    line-height: 22px;
  }
`
