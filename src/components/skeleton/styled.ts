import styled from 'vue3-styled-components'

interface SkeletonAttrs {
  w: string
  h: string
  br: string
}

const skeletonAttrs = { w: String, h: String, br: String }

// Скелетон в оформлении Nuxt UI (USkeleton): подложка elevated и пульсация
// прозрачностью вместо бегущего блика.
export const SC_Skeleton = styled<SkeletonAttrs>('div', skeletonAttrs)`
  display: inline-block;
  width: ${(p) => p.w};
  height: ${(p) => p.h};
  border-radius: ${(p) => p.br};
  background: var(--ui-bg-elevated);
  animation: skeleton-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;

  @keyframes skeleton-pulse {
    50% {
      opacity: 0.5;
    }
  }
`
