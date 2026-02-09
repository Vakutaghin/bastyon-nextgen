<template>
  <SC_PostCard ref="postCardRef" hoverable>
    <PostCardHeader :post="post" :author-override="authorOverride" />

    <PostCardImages
      v-if="post.images && post.images.length > 0"
      :images="post.images"
    />

    <VideoPlayer
      v-else-if="(post.type === 'video' || post.type === 'audio') && post.videoUrl"
      :video-url="post.videoUrl"
      :is-audio="post.type === 'audio'"
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
  </SC_PostCard>

  <Teleport v-if='!showFull' to='body'>
    <PostModal
      :isOpen='isModalOpen'
      :post='post'
      @close='closePostModal'
      @like='handleLike'
      @comment='handleComment'
      @share='handleShare'
    />
  </Teleport>

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
