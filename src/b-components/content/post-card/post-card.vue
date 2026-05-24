<template>
  <SC_PostCard ref="postCardRef" hoverable>
    <PostCardHeader :post="post" :author-override="authorOverride" />

    <component :is="isRepost ? 'SC_RepostInnerCard' : 'div'">
      <SC_RepostDeleted v-if="isRepost && post.repostDeleted">
        <DeleteOutlined class="repost-deleted-icon" />
        <span>Публикация удалена</span>
      </SC_RepostDeleted>

      <template v-else>
        <SC_RepostOriginalAuthor v-if="isRepost && post.repostAuthor">
          <router-link :to="'/' + (post.repostAuthor.name || post.repostAuthor.address)" class="author-link">
            <Avatar
              :src="post.repostAuthor.avatar"
              :alt="post.repostAuthor.name || post.repostAuthor.address"
              :fallback-text="post.repostAuthor.name || post.repostAuthor.address"
              :size="50"
            />
          </router-link>
          <SC_RepostOriginalAuthorInfo>
            <SC_RepostOriginalAuthorName>
              <router-link :to="'/' + (post.repostAuthor.name || post.repostAuthor.address)">
                {{ post.repostAuthor.name || post.repostAuthor.address }}
              </router-link>
            </SC_RepostOriginalAuthorName>
            <SC_RepostOriginalAuthorTime v-if="originalAuthorFormattedTime">
              {{ originalAuthorFormattedTime }}
            </SC_RepostOriginalAuthorTime>
          </SC_RepostOriginalAuthorInfo>
        </SC_RepostOriginalAuthor>

        <PostCardImages
          v-if="post.images && post.images.length > 0"
          :images="post.images"
        />

        <VideoPlayer
          v-else-if="(post.type === 'video' || post.type === 'audio') && post.videoUrl"
          ref="videoPlayerRef"
          :video-url="post.videoUrl"
          :is-audio="post.type === 'audio'"
          :chapters="chapters"
        />

        <PostCardVideoPlaceholder
          v-else-if="post.type === 'video' || post.type === 'audio'"
        />

        <SC_PostTitle v-if="decodedTitle">
          {{ decodedTitle }}
        </SC_PostTitle>

        <PostCardContent
          :post="post"
          :max-length="maxLength"
          :max-blocks="maxBlocks"
          :show-full="showFull"
          :is-collapsed="isCollapsed"
          :chapters="chapters"
          @seek-timecode="handleSeekTimecode"
        />

        <SC_PostCardYoutube v-if="(youtubeEmbedUrls || []).length">
          <iframe
            v-for="(embedUrl, i) in youtubeEmbedUrls"
            :key="i"
            :src="embedUrl"
            title="YouTube video player"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerpolicy="strict-origin-when-cross-origin"
            allowfullscreen
          />
        </SC_PostCardYoutube>

        <PostCardCategoriesTags :post="post" />

        <SC_PostActions>
          <StarRating
            v-if='post.hash || post.txid || post.id'
            :rating='averageRating'
            :user-vote='post.myVal'
            :voters-count='post.scoreCnt || 0'
            :score-sum='post.scoreSum || 0'
            :share-id='post.hash || post.txid || post.id || ""'
            :content-author-address="post.author?.address || ''"
            @rating-change='handleRatingChange'
            @error='handleRatingError'
          />
        </SC_PostActions>

        <PostCardComments
          :post="post"
          @collapsed="onCommentsCollapsed"
        />
      </template>
    </component>
  </SC_PostCard>

  <ImageGallery
    v-if='post.images && post.images.length > 0'
    v-model:visible='isImageGalleryOpen'
    :images='post.images'
    :initial-index='galleryIndex'
    @hide='closeImageGallery'
  />
</template>

<script>
import { postCardOptions } from './post-card.ts'

export default postCardOptions
</script>
