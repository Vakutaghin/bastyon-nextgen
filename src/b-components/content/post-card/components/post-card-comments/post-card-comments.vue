<template>
  <SC_CommentsPreview v-if="hasUserComments || allComments">
    <h3>Комментарии ({{ totalCommentsCount }})</h3>

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
            <span
              :class="['comment-score', { 'comment-score--voted': lastCommentUserLiked, 'comment-score--clickable': lastCommentCanClickLike }]"
              role="button"
              tabindex="0"
              @click.stop.prevent="onLastCommentScoreUp()"
            >👍 {{ post.lastComment?.scoreUp ?? 0 }}</span>

            <span
              :class="['comment-score', { 'comment-score--voted': lastCommentUserDisliked, 'comment-score--clickable': lastCommentCanClickDislike }]"
              role="button"
              tabindex="0"
              @click.stop.prevent="onLastCommentScoreDown()"
            >👎 {{ post.lastComment?.scoreDown ?? 0 }}</span>
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
            <span
              :class="['comment-score', { 'comment-score--voted': lastCommentUserLiked, 'comment-score--clickable': lastCommentCanClickLike }]"
              role="button"
              tabindex="0"
              @click.stop.prevent="onLastCommentScoreUp()"
            >👍 {{ post.lastComment?.scoreUp ?? 0 }}</span>
            <span
              :class="['comment-score', { 'comment-score--voted': lastCommentUserDisliked, 'comment-score--clickable': lastCommentCanClickDislike }]"
              role="button"
              tabindex="0"
              @click.stop.prevent="onLastCommentScoreDown()"
            >👎 {{ post.lastComment?.scoreDown ?? 0 }}</span>
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

    <!-- Развёрнутый вид: сортировка + список с пагинацией -->
    <template v-else>
      <SC_CommentsSortRow>
        <label for="comments-sort">Сортировка:</label>
        <SC_CommentsSortSelect
          id="comments-sort"
          :value="commentsSortOrder"
          @change="setCommentsSortOrder($event)"
        >
          <option value="interesting">Сначала интересные</option>
          <option value="newest">Сначала новые</option>
          <option value="oldest">Сначала старые</option>
        </SC_CommentsSortSelect>
      </SC_CommentsSortRow>

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
            <span
              :class="['comment-score', { 'comment-score--voted': isCommentLiked(comment), 'comment-score--clickable': commentCanClickLike(comment) }]"
              role="button"
              tabindex="0"
              @click.stop.prevent="onCommentScoreUp(comment)"
            >👍 {{ comment.scoreUp ?? 0 }}</span>

            <span
              :class="['comment-score', { 'comment-score--voted': isCommentDisliked(comment), 'comment-score--clickable': commentCanClickDislike(comment) }]"
              role="button"
              tabindex="0"
              @click.stop.prevent="onCommentScoreDown(comment)"
            >👎 {{ comment.scoreDown ?? 0 }}</span>
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
</template>

<script>
import { postCardCommentsOptions } from './post-card-comments.ts'

export default postCardCommentsOptions
</script>
