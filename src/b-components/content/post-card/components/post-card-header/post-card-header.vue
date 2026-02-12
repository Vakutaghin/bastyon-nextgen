<template>
  <SC_PostHeader>
    <SC_PostAuthor>
      <SC_AuthorLinkWrap>
        <router-link :to="'/' + (displayAuthor.name || displayAuthor.address)" class="author-link">
          <Avatar
            :src="displayAuthor.avatar"
            :alt="displayAuthor.name || displayAuthor.letter"
            :fallback-text="displayAuthor.name"
            :size="50"
            :verified="displayAuthor.verified"
          />
        </router-link>
      </SC_AuthorLinkWrap>

      <SC_PostAuthorInfo>
        <SC_AuthorNameRow>
          <router-link :to="'/' + (displayAuthor.name || displayAuthor.address)" class="author-link">
            <SC_PostAuthorName>{{ displayAuthor.name }}</SC_PostAuthorName>
          </router-link>

          <SC_ChatBtn
            v-if="displayAuthor.address"
            type="button"
            aria-label="Начать чат"
            @click.stop.prevent="startChatWithAuthor"
          >
            <MessageOutlined :style="{ fontSize: '16px' }" />
          </SC_ChatBtn>

          <SC_PostAuthorRep>{{ formattedReputation }}</SC_PostAuthorRep>
        </SC_AuthorNameRow>

        <SC_PostTime>{{ formatTime(post.timestamp) }}</SC_PostTime>

        <SC_RepostLine v-if="post.repost">
          <ShareAltOutlined class="repost-icon" />
          <span class="repost-text">Репост</span>
          <template v-if="post.repostAuthor">
            <span class="repost-from"> от </span>
            <router-link :to="'/' + (post.repostAuthor.name || post.repostAuthor.address)" class="repost-author">
              {{ post.repostAuthor.name || post.repostAuthor.address }}
            </router-link>
          </template>
          <span v-else class="repost-record"> записи</span>
        </SC_RepostLine>
      </SC_PostAuthorInfo>
    </SC_PostAuthor>

    <SC_PostBookmark @click="toggleBookmark">
      <BookFilled v-if="isBookmarked" :style="{ color: '#00a4ff', fontSize: '18px' }" />
      <BookOutlined v-else :style="{ fontSize: '18px', color: 'rgba(0,0,0,0.45)' }" />
    </SC_PostBookmark>
  </SC_PostHeader>
</template>

<script>
import { postCardHeaderOptions } from './post-card-header.ts'

export default postCardHeaderOptions
</script>
