import styled from 'vue3-styled-components'
import { COLORS } from '@/styles/theme-colors'

interface SkeletonAttrs {
  w: string
  h: string
  br: string
}

const skeletonAttrs = { w: String, h: String, br: String }

export const SC_Skeleton = styled<SkeletonAttrs>('div', skeletonAttrs)`
  width: ${(p) => p.w};
  height: ${(p) => p.h};
  border-radius: ${(p) => p.br};
  background: linear-gradient(
    90deg,
    ${COLORS.GRAY_F1} 0%,
    ${COLORS.GRAY_E8} 50%,
    ${COLORS.GRAY_F1} 100%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.4s ease-in-out infinite;
  display: inline-block;

  @keyframes skeleton-shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
`
