<template>
  <SC_PostModalWrapper>
    <Modal
      :open='isModalOpen'
      title='Пост'
      :full-width='fullWidth'
      :centered='true'
      :closable='true'
      :maskClosable='true'
      :footer='null'
      :destroyOnClose='true'
      @cancel='closeModal'
    >
      <SC_PostModalContent v-if='isModalOpen && postData' :key='postData.id ?? postData.txid ?? ""'>
        <PostCard
          :post='postData'
          :show-full='true'
          @like='handleLike'
          @comment='handleComment'
          @share='handleShare'
        />
      </SC_PostModalContent>
    </Modal>
  </SC_PostModalWrapper>
</template>

<script>
import { postModalOptions } from './post-modal.ts'

export default postModalOptions
</script>

