import styled from 'vue3-styled-components'
import Tag from '@/components/tag/tag.vue'

export const SC_PostCategoriesAndTags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-bottom: 15px;
`

export const SC_ClickableTag = styled(Tag)`
  cursor: pointer;
`
