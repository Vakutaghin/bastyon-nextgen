<template>
  <SC_PostCard ref="postCardRef" hoverable>
    <SC_PostHeader>
      <SC_PostAuthor>
        <SC_AuthorLinkWrap>
          <router-link :to="'/' + (displayAuthor.name || displayAuthor.address)" class="author-link">
            <Avatar
            :src='displayAuthor.avatar'
            :alt='displayAuthor.name || displayAuthor.letter'
            :fallback-text='displayAuthor.name'
            :size='50'
            :verified='displayAuthor.verified'
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
        </SC_PostAuthorInfo>
      </SC_PostAuthor>

      <SC_PostBookmark @click="toggleBookmark">
        <BookFilled v-if="isBookmarked" :style="{ color: '#00a4ff', fontSize: '18px' }" />
        <BookOutlined v-else :style="{ fontSize: '18px', color: 'rgba(0,0,0,0.45)' }" />
      </SC_PostBookmark>
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

    <SC_CommentsPreview v-if="hasUserComments || allComments">
      <!-- Компактный вид: комментарии ещё не загружены -->
      <template v-if="!allComments">
        <SC_CommentItem v-if="hasUserComments">
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

        <SC_CommentsActionsRow v-if="totalCommentsCount > 0">
          <SC_CommentsActionsLeft>
            <SC_CommentsLoading v-if="allCommentsLoading">
              <LoadingOutlined :style="{ fontSize: '18px', color: '#00a4ff' }" spin />
            </SC_CommentsLoading>
            <template v-else>
              <SC_ShowCommentsBtn
                type="button"
                @click.stop.prevent="loadAllComments(false)"
              >
                Показать ещё 15
              </SC_ShowCommentsBtn>
              <SC_ShowCommentsBtnSecondary
                type="button"
                @click.stop.prevent="loadAllComments(true)"
              >
                Показать все
              </SC_ShowCommentsBtnSecondary>
            </template>
          </SC_CommentsActionsLeft>
        </SC_CommentsActionsRow>
      </template>

      <!-- Компактный вид: комментарии загружены, но свернуты -->
      <template v-else-if="commentsCollapsed">
        <SC_CommentItem v-if="hasUserComments">
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

        <SC_ShowCommentsBtn
          type="button"
          @click.stop.prevent="expandComments"
        >
          Развернуть комментарии ({{ actualCommentsCount }})
        </SC_ShowCommentsBtn>
      </template>

      <!-- Развёрнутый вид: список с пагинацией -->
      <template v-else>
        <SC_CommentItem
          v-for="comment in visibleComments"
          :key="comment.id"
        >
          <router-link :to="getCommentProfileLink(comment)">
            <div v-if="getCommentAvatarUrl(comment.userprofile)" class="comment-avatar">
              <img :src="getCommentAvatarUrl(comment.userprofile)" :alt="comment.userprofile?.name" />
            </div>
            <div v-else class="comment-avatar-placeholder">
              {{ (comment.userprofile?.name || '?').charAt(0).toUpperCase() }}
            </div>
          </router-link>

          <SC_CommentContent>
            <SC_CommentMeta>
              <router-link :to="getCommentProfileLink(comment)">
                <SC_CommentAuthor>{{ comment.userprofile?.name || comment.address }}</SC_CommentAuthor>
              </router-link>
              <SC_CommentDate>{{ formatCommentDate(comment.time) }}</SC_CommentDate>
            </SC_CommentMeta>
            <SC_CommentText v-html="formatCommentMessageHtml(comment)"></SC_CommentText>
            <SC_CommentActions>
              <span>👍</span>
              <span>👎</span>
              <span>Ответить</span>
            </SC_CommentActions>
          </SC_CommentContent>
        </SC_CommentItem>

        <SC_CommentsActionsRow>
          <SC_CommentsActionsLeft>
            <SC_ShowCommentsBtn
              v-if="hasMoreCommentsToShow"
              type="button"
              @click.stop.prevent="showMoreComments"
            >
              Показать ещё {{ nextCommentsPageSize }}
            </SC_ShowCommentsBtn>
            <SC_ShowCommentsBtnSecondary
              v-if="hasMoreCommentsToShow"
              type="button"
              @click.stop.prevent="showAllComments"
            >
              Показать все
            </SC_ShowCommentsBtnSecondary>
          </SC_CommentsActionsLeft>
          <SC_ShowCommentsBtnCollapse
            type="button"
            @click.stop.prevent="collapseComments"
          >
            Свернуть
          </SC_ShowCommentsBtnCollapse>
        </SC_CommentsActionsRow>
      </template>
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
