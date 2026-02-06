<template>
  <SC_PostModalWrapper>
    <a-modal
      v-model:open='isModalOpen'
      title='Пост'
      :width='800'
      :centered='true'
      :closable='true'
      :maskClosable='true'
      :footer='null'
      @cancel='closeModal'
    >
      <SC_PostModalContent v-if='postData'>
        <PostCard
          :post='postData'
          :show-full='true'
          @like='handleLike'
          @comment='handleComment'
          @share='handleShare'
        />
      </SC_PostModalContent>
    </a-modal>
  </SC_PostModalWrapper>
</template>

<script>
import { postModalOptions } from './post-modal.ts'

export default postModalOptions
</script>

