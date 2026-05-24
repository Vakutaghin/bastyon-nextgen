<template>
  <SC_Feed ref='feedRootRef'>
    <SC_FeedHeader>
      <SC_FeedHeaderLeft>
        <SC_SidebarToggleWrap>
          <Button
            type='text'
            size='small'
            :title='leftSidebarCollapsed ? "Развернуть меню" : "Свернуть меню"'
            @click='$emit("toggle-left-sidebar")'
          >
            <MenuUnfoldOutlined v-if='leftSidebarCollapsed' :style='{ fontSize: "16px" }' />
            <MenuFoldOutlined v-else :style='{ fontSize: "16px" }' />
          </Button>
        </SC_SidebarToggleWrap>
        <SC_FeedTitle>Лента</SC_FeedTitle>
        <SC_FeedRefreshWrap>
          <Button
            type='text'
            size='small'
            title='Обновить ленту'
            :loading='isLoading && allPosts.length > 0'
            @click='refetch'
          >
            <template #icon>
              <ReloadOutlined :style='{ fontSize: "14px" }' />
            </template>
            Обновить ленту
          </Button>
        </SC_FeedRefreshWrap>
      </SC_FeedHeaderLeft>

      <SC_FeedHeaderActions>
        <Button type='primary' :loading='isPickingPhoto' @click='handleCreatePost'>
          <template #icon>
            <PlusOutlined />
          </template>
          Создать пост
        </Button>

        <SC_SidebarToggleWrap>
          <Button
            type='text'
            size='small'
            :title='rightSidebarVisible ? "Скрыть боковую панель" : "Показать боковую панель"'
            @click='$emit("toggle-right-sidebar")'
          >
            <MenuUnfoldOutlined v-if='rightSidebarVisible' :style='{ fontSize: "16px" }' />
            <MenuFoldOutlined v-else :style='{ fontSize: "16px" }' />
          </Button>
        </SC_SidebarToggleWrap>
      </SC_FeedHeaderActions>
    </SC_FeedHeader>

    <SC_FeedContent>
      <SC_FeedLoading v-if='isLoading && allPosts.length === 0'>
        <Spin tip='Загрузка ленты...'>
          <template #indicator>
            <LoadingOutlined :style="{ fontSize: '120px', color: 'rgb(0, 123, 255)' }" spin />
          </template>
        </Spin>
      </SC_FeedLoading>

      <SC_FeedError v-else-if='error'>
        <div v-if="isServerError" style="display: flex; flex-direction: column; align-items: center;">
          <ExclamationCircleOutlined style='font-size: 30px; margin-bottom: 15px; color: rgb(220, 53, 69);' />
          <p>Сервер временно недоступен</p>
          <Button @click="refetch" type="primary" ghost style="margin-top: 10px;">
            <template #icon><ReloadOutlined /></template>
            Обновить
          </Button>
        </div>
        <div v-else style="display: flex; flex-direction: column; align-items: center;">
          <ExclamationCircleOutlined style='font-size: 30px; margin-bottom: 15px; color: rgb(220, 53, 69);' />
          <p>{{ error }}</p>
        </div>
      </SC_FeedError>
      <template v-else-if='allPosts && allPosts.length > 0'>
        <PostCard
          v-for='(post, index) in allPosts'
          :key='`post-${post.id || index}`'
          v-memo='[post.id, post.likes, post.comments, post.shares]'
          :post='post'
          @like='handleLike'
          @comment='handleComment'
          @share='handleShare'
        />
        <!-- Триггер для lazy loading с безопасным расстоянием -->
        <div
          ref='loadMoreTrigger'
          :style='{ height: "1px", width: "100%" }'
        />
        <!-- Индикатор загрузки следующей порции -->
        <SC_FeedLoadingMore v-if='isLoadingMore'>
          <Spin size='small' tip='Загрузка...'>
            <template #indicator>
              <LoadingOutlined :style="{ fontSize: '24px', color: 'rgb(0, 123, 255)' }" spin />
            </template>
          </Spin>
        </SC_FeedLoadingMore>
        <!-- Сообщение, если больше нет постов -->
        <SC_FeedEnd v-else-if='!hasMore && allPosts.length > 0 && !isFavoritesTab'>
          <p>Все посты загружены</p>
        </SC_FeedEnd>
      </template>
      <Empty v-else-if='!isLoading' description='Лента пуста' />
    </SC_FeedContent>

    <SC_ScrollToTop
      v-show='showScrollToTopVisible'
      type='button'
      aria-label='Наверх'
      :style='scrollToTopButtonStyle'
      @click='scrollToTop'
      @mouseenter='isHoveringScrollToTop = true'
      @mouseleave='isHoveringScrollToTop = false'
    >
      <UpOutlined />
      Наверх
    </SC_ScrollToTop>

    <div
      v-if='pickedPhotoDataUrl'
      style='position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 3000; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 16px; gap: 16px;'
      @click='closePhotoPreview'
    >
      <img :src='pickedPhotoDataUrl' style='max-width: 100%; max-height: 70vh; border-radius: 8px;' />
      <div style='color: white; font-size: 14px; opacity: 0.85;'>Тап в любом месте — закрыть</div>
    </div>
  </SC_Feed>
</template>

<script>
import { ReloadOutlined, UpOutlined } from '@ant-design/icons-vue'
import { contentFeedOptions } from './content-feed.ts'

export default {
  ...contentFeedOptions,
  components: {
    ...(contentFeedOptions.components || {}),
    ReloadOutlined,
    UpOutlined
  }
}
</script>
