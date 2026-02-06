<template>
  <SC_PostCard hoverable>
    <SC_PostHeader>
      <SC_PostAuthor>
        <router-link :to="'/' + (displayAuthor.name || displayAuthor.address)" class="author-link" style="display: block;">
          <Avatar
            :src='displayAuthor.avatar'
            :alt='displayAuthor.name || displayAuthor.letter'
            :fallback-text='displayAuthor.name'
            :size='50'
            :verified='displayAuthor.verified'
          />
        </router-link>

        <SC_PostAuthorInfo>
          <SC_AuthorNameRow>
            <router-link :to="'/' + (displayAuthor.name || displayAuthor.address)" class="author-link">
              <SC_PostAuthorName>{{ displayAuthor.name }}</SC_PostAuthorName>
            </router-link>

            <SC_PostAuthorRep>{{ formattedReputation }}</SC_PostAuthorRep>
          </SC_AuthorNameRow>

          <SC_PostTime>{{ formatTime(post.timestamp) }}</SC_PostTime>
        </SC_PostAuthorInfo>
      </SC_PostAuthor>

      <div class="post-bookmark" @click="toggleBookmark" style="margin-left: auto; cursor: pointer; padding: 0 10px;">
        <BookFilled v-if="isBookmarked" :style="{ color: '#00a4ff', fontSize: '18px' }" />
        <BookOutlined v-else :style="{ fontSize: '18px', color: 'rgba(0,0,0,0.45)' }" />
      </div>
    </SC_PostHeader>

    <SC_PostImage
      v-if='post.images && post.images.length > 0'
      :imageCount='imageCount'
    >
      <SC_ImageWrapper
        v-for='(imageUrl, idx) in post.images'
        :key='idx'
        :imageCount='imageCount'
        :style='getImageWrapperStyle(idx)'
        @click.stop='openImageGallery(idx)'
      >
        <img
          :src='imageUrl'
          :alt='`Изображение ${idx + 1}`'
          :style='getImageStyle(idx)'
          @error='handleImageError'
          @load='(e) => handleImageLoad(e, idx)'
        />
        <SC_ImageOverlay
          @click.stop='openImageGallery(idx)'
        >
          <SC_ZoomIconCircle>
            <ZoomInOutlined />
          </SC_ZoomIconCircle>
        </SC_ImageOverlay>
      </SC_ImageWrapper>
    </SC_PostImage>

    <VideoPlayer
      v-else-if="(post.type === 'video' || post.type === 'audio') && post.videoUrl"
      :video-url="post.videoUrl"
      :is-audio="post.type === 'audio'"
    />

    <SC_VideoPlaceholder v-else-if="post.type === 'video' || post.type === 'audio'">
      <PlayCircleFilled />
    </SC_VideoPlaceholder>

    <SC_PostTitle v-if='decodedTitle'>
      {{ decodedTitle }}
    </SC_PostTitle>

    <SC_PostContent>
      <BlockContent
        v-if='isBlockContent && (showFull || !isCollapsed || !shouldCollapse)'
        :content='post.content'
      />

      <div v-else-if="post.preview && isCollapsed && shouldCollapse" style="margin-bottom: 10px;" v-html="formattedPreview">
      </div>

      <!-- Для статей в свернутом виде используем formattedTruncatedText вместо BlockContent для контроля длины -->
      <SC_PostPreview
        v-else-if="isBlockContent && post.type === 'article' && isCollapsed && shouldCollapse"
        v-html="formattedTruncatedText"
      >
      </SC_PostPreview>

      <BlockContent
        v-else-if='isBlockContent'
        :content='truncatedBlockContent'
      />

      <div v-else-if='showFull || !isCollapsed || !shouldCollapse' v-html='formattedPlainText'></div>

      <SC_PostPreview v-else v-html='formattedTruncatedText'></SC_PostPreview>

      <Button
        v-if='!showFull && shouldCollapse && isCollapsed'
        type='text'
        block
        @click.stop.prevent='openPostModal'
        style="margin-top: 10px; background-color: #eee;"
      >
        <strong>{{ readMoreLabel }}</strong>
      </Button>
    </SC_PostContent>

    <SC_PostCategoriesAndTags v-if='displayItems && displayItems.length'>
      <template v-for='item in displayItems' :key='item.id || item.name'>
        <Tag v-if="item.type === 'category'" @click.stop.prevent="handleTagClick(item)" style="cursor: pointer;">
          {{ item.icon }} {{ item.name }}
        </Tag>
        <Tag v-else @click.stop.prevent="handleTagClick(item)" style="cursor: pointer;">
          #{{ item.name }}
        </Tag>
      </template>
    </SC_PostCategoriesAndTags>

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

    <SC_CommentsPreview v-if="hasUserComments">
      <SC_CommentItem>
        <router-link :to="lastCommentProfileLink">
          <div v-if="lastCommentAvatarUrl" class="comment-avatar">
            <img :src="lastCommentAvatarUrl" :alt="post.lastComment.authorName" />
          </div>

          <div v-else class="comment-avatar-placeholder">
            {{ lastCommentInitial }}
          </div>
        </router-link>

        <SC_CommentContent>
          <SC_CommentMeta>
            <router-link :to="lastCommentProfileLink">
              <SC_CommentAuthor>{{ post.lastComment.authorName }}</SC_CommentAuthor>
            </router-link>

            <SC_CommentDate>{{ lastCommentDateOnly }}</SC_CommentDate>
          </SC_CommentMeta>

          <SC_CommentText v-html="lastCommentMessageHtml"></SC_CommentText>

          <SC_CommentActions>
            <span>👍</span>
            <span>👎</span>
            <span>Ответить</span>
          </SC_CommentActions>
        </SC_CommentContent>
      </SC_CommentItem>
    </SC_CommentsPreview>
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

<style scoped>
</style>
