<template>
  <SC_LastCommentsRoot>
    <SC_LastCommentsCaption>Последние комментарии</SC_LastCommentsCaption>
    <SC_LastCommentsLoading v-if="isLoading">
      <Spin size="small">
        <template #indicator>
          <LoadingOutlined :style="{ fontSize: '24px', color: 'rgb(0, 123, 255)' }" spin />
        </template>
      </Spin>
    </SC_LastCommentsLoading>
    <SC_LastCommentsEmpty v-else-if="!displayComments.length">Нет комментариев</SC_LastCommentsEmpty>
    <SC_LastCommentsList v-else>
      <SC_LastCommentItem
        v-for="item in displayComments"
        :key="item.id"
        @click="openPost(item.postid)"
      >
        <SC_LastCommentIcons>
          <SC_LastCommentAvatar>
            <img v-if="getAvatarUrl(item.authorProfile)" :src="getAvatarUrl(item.authorProfile)!" :alt="getDisplayName(item.authorProfile, item.address)" />
            <SC_LastCommentLetter v-else>{{ getDisplayName(item.authorProfile, item.address).charAt(0).toUpperCase() }}</SC_LastCommentLetter>
          </SC_LastCommentAvatar>
          <SC_LastCommentArrow class="fas fa-long-arrow-alt-right" />
          <SC_LastCommentAvatar>
            <img v-if="item.commentTo && getAvatarUrl(item.toProfile)" :src="getAvatarUrl(item.toProfile)!" :alt="item.commentTo ? getDisplayName(item.toProfile, item.commentTo) : ''" />
            <SC_LastCommentLetter v-else>{{ item.commentTo ? getDisplayName(item.toProfile, item.commentTo).charAt(0).toUpperCase() : '?' }}</SC_LastCommentLetter>
          </SC_LastCommentAvatar>
        </SC_LastCommentIcons>
        <SC_LastCommentContent>
          <SC_LastCommentNames>{{ getDisplayName(item.authorProfile, item.address) }}</SC_LastCommentNames>
          <span> → </span>
          <SC_LastCommentNames>{{ item.commentTo ? getDisplayName(item.toProfile, item.commentTo) : '—' }}</SC_LastCommentNames>: <SC_LastCommentMessage>{{ item.message }}</SC_LastCommentMessage>
        </SC_LastCommentContent>
      </SC_LastCommentItem>
    </SC_LastCommentsList>
  </SC_LastCommentsRoot>
</template>

<script lang="ts">
import { lastCommentsOptions } from './last-comments'
export default lastCommentsOptions
</script>
