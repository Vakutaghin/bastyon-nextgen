<template>
  <SC_ProfileFeed>
    <SC_ErrorMessage v-if="error">
      Произошла ошибка при загрузке ленты
    </SC_ErrorMessage>

    <SC_FeedContent>
      <PostCard
        v-for="post in allPosts"
        :key="post.txid"
        :post="post"
        :author-override="authorOverride"
      />
    </SC_FeedContent>

    <div v-if="isLoading && allPosts.length === 0" style="padding: 40px; text-align: center;">
      <Spin tip="Загрузка ленты...">
        <template #indicator>
          <LoadingOutlined :style="{ fontSize: '50px', color: 'rgb(0, 123, 255)' }" spin />
        </template>
      </Spin>
    </div>

    <SC_LoadMoreTrigger ref="loadMoreTrigger" v-else>
      <SC_LoadingSpinner v-if="isLoadingMore || isLoading">
        <Spin tip="Загрузка...">
          <template #indicator>
            <LoadingOutlined :style="{ fontSize: '24px', color: 'rgb(0, 123, 255)' }" spin />
          </template>
        </Spin>
      </SC_LoadingSpinner>
      <SC_NoMorePosts v-else-if="!hasMore && allPosts.length > 0">
        Больше постов нет
      </SC_NoMorePosts>
      <SC_EmptyFeed v-else-if="!hasMore && allPosts.length === 0">
        У пользователя пока нет постов
      </SC_EmptyFeed>
    </SC_LoadMoreTrigger>
  </SC_ProfileFeed>
</template>

<script lang="ts">
import ProfileFeed from './profile-feed.ts'
export default ProfileFeed
</script>
