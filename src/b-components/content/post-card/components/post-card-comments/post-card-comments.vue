<template>
  <SC_CommentsPreview v-if="hasUserComments || allComments">
    <h3>Комментарии ({{ totalCommentsCount }})</h3>

    <!-- Компактный вид: комментарии ещё не загружены -->
    <template v-if="!allComments">
      <SC_CommentWithReplies v-if="hasUserComments">
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
            <SC_CommentRepliesLink
              v-if="lastCommentChildren > 0"
              role="button"
              tabindex="0"
              @click.stop.prevent="onLastCommentRepliesClick"
            >
              Ответы ({{ lastCommentChildren }})
            </SC_CommentRepliesLink>
            <span
              role="button"
              tabindex="0"
              @click.stop.prevent="onLastCommentReply"
            >Ответить</span>
            <span
              role="button"
              tabindex="0"
              @click.stop.prevent="onLastCommentReplyToAuthor"
            >Ответить автору</span>
          </SC_CommentActions>
        </SC_CommentContent>
      </SC_CommentItem>
        <!-- Плашка ответа под последним комментарием (комментарии ещё не загружены) -->
        <SC_ReplyPanel v-if="lastCommentId && isReplyPanelOpen(lastCommentId)">
          <div v-if="currentUserAvatarUrl" class="reply-avatar">
            <img :src="currentUserAvatarUrl" alt="" />
          </div>
          <div v-else class="reply-avatar-placeholder">{{ currentUserInitial }}</div>
          <SC_ReplyInputWrap>
            <SC_ReplyTextarea
              :key="replyPanelKey"
              ref="replyTextareaRef"
              v-model="replyDraft"
              placeholder="Введите ответ... (введите @ чтобы упомянуть пользователя)"
              rows="2"
              @input="handleReplyInput"
              @keydown="handleReplyKeydown"
            />
            <SC_MentionList
              ref="mentionListRef"
              v-if="showMentionList && filteredMentionUsers.length > 0"
            >
              <SC_MentionItem
                v-for="(u, idx) in filteredMentionUsers"
                :key="u.address"
                type="button"
                :class="{ 'mention-item--highlighted': mentionHighlightIndex === idx }"
                @click.stop.prevent="selectMentionUser(u)"
              >
                {{ u.name }}
              </SC_MentionItem>
            </SC_MentionList>
          </SC_ReplyInputWrap>
          <SC_ReplyCancelBtn type="button" title="Отменить" @click.stop.prevent="requestCloseReply">
            <CloseOutlined />
          </SC_ReplyCancelBtn>
          <SC_ReplySendBtn
            type="button"
            title="Отправить"
            :disabled="!(replyDraft || '').trim()"
            @click.stop.prevent="sendReply"
          >
            <SendOutlined />
          </SC_ReplySendBtn>
        </SC_ReplyPanel>
      </SC_CommentWithReplies>

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
      <SC_CommentWithReplies v-if="hasUserComments">
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
            <SC_CommentRepliesLink
              v-if="lastCommentChildren > 0"
              role="button"
              tabindex="0"
              @click.stop.prevent="onLastCommentRepliesClick"
            >
              Ответы ({{ lastCommentChildren }})
            </SC_CommentRepliesLink>
            <span
              role="button"
              tabindex="0"
              @click.stop.prevent="onLastCommentReply"
            >Ответить</span>
            <span
              role="button"
              tabindex="0"
              @click.stop.prevent="onLastCommentReplyToAuthor"
            >Ответить автору</span>
          </SC_CommentActions>
        </SC_CommentContent>
      </SC_CommentItem>
        <!-- Плашка ответа под последним комментарием (комментарии свернуты) -->
        <SC_ReplyPanel v-if="lastCommentId && isReplyPanelOpen(lastCommentId)">
          <div v-if="currentUserAvatarUrl" class="reply-avatar">
            <img :src="currentUserAvatarUrl" alt="" />
          </div>
          <div v-else class="reply-avatar-placeholder">{{ currentUserInitial }}</div>
          <SC_ReplyInputWrap>
            <SC_ReplyTextarea
              :key="replyPanelKey"
              ref="replyTextareaRef"
              v-model="replyDraft"
              placeholder="Введите ответ... (введите @ чтобы упомянуть пользователя)"
              rows="2"
              @input="handleReplyInput"
              @keydown="handleReplyKeydown"
            />
            <SC_MentionList
              ref="mentionListRef"
              v-if="showMentionList && filteredMentionUsers.length > 0"
            >
              <SC_MentionItem
                v-for="(u, idx) in filteredMentionUsers"
                :key="u.address"
                type="button"
                :class="{ 'mention-item--highlighted': mentionHighlightIndex === idx }"
                @click.stop.prevent="selectMentionUser(u)"
              >
                {{ u.name }}
              </SC_MentionItem>
            </SC_MentionList>
          </SC_ReplyInputWrap>
          <SC_ReplyCancelBtn type="button" title="Отменить" @click.stop.prevent="requestCloseReply">
            <CloseOutlined />
          </SC_ReplyCancelBtn>
          <SC_ReplySendBtn
            type="button"
            title="Отправить"
            :disabled="!(replyDraft || '').trim()"
            @click.stop.prevent="sendReply"
          >
            <SendOutlined />
          </SC_ReplySendBtn>
        </SC_ReplyPanel>
      </SC_CommentWithReplies>

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

      <SC_CommentWithReplies
        v-for="comment in visibleComments"
        :key="comment.id"
      >
        <SC_CommentRow>
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
              <SC_CommentRepliesLink
                v-if="(comment.children ?? 0) > 0"
                role="button"
                tabindex="0"
                @click.stop.prevent="onRepliesClick(comment)"
              >
                Ответы ({{ comment.children }})
              </SC_CommentRepliesLink>
              <span
                role="button"
                tabindex="0"
                @click.stop.prevent="onReplyToFirstLevel(comment)"
              >Ответить</span>
              <span
                role="button"
                tabindex="0"
                @click.stop.prevent="onReplyToAuthorFirstLevel(comment)"
              >Ответить автору</span>
            </SC_CommentActions>
          </SC_CommentContent>
        </SC_CommentRow>

        <!-- Плашка ответа под комментарием первого уровня -->
        <SC_ReplyPanel v-if="isReplyPanelOpen(comment.id)">
          <div v-if="currentUserAvatarUrl" class="reply-avatar">
            <img :src="currentUserAvatarUrl" alt="" />
          </div>
          <div v-else class="reply-avatar-placeholder">{{ currentUserInitial }}</div>
          <SC_ReplyInputWrap>
            <SC_ReplyTextarea
              :key="replyPanelKey"
              ref="replyTextareaRef"
              v-model="replyDraft"
              placeholder="Введите ответ... (введите @ чтобы упомянуть пользователя)"
              rows="2"
              @input="handleReplyInput"
              @keydown="handleReplyKeydown"
            />
            <SC_MentionList
              ref="mentionListRef"
              v-if="showMentionList && filteredMentionUsers.length > 0"
            >
              <SC_MentionItem
                v-for="(u, idx) in filteredMentionUsers"
                :key="u.address"
                type="button"
                :class="{ 'mention-item--highlighted': mentionHighlightIndex === idx }"
                @click.stop.prevent="selectMentionUser(u)"
              >
                {{ u.name }}
              </SC_MentionItem>
            </SC_MentionList>
          </SC_ReplyInputWrap>
          <SC_ReplyCancelBtn type="button" title="Отменить" @click.stop.prevent="requestCloseReply">
            <CloseOutlined />
          </SC_ReplyCancelBtn>
          <SC_ReplySendBtn
            type="button"
            title="Отправить"
            :disabled="!(replyDraft || '').trim()"
            @click.stop.prevent="sendReply"
          >
            <SendOutlined />
          </SC_ReplySendBtn>
        </SC_ReplyPanel>

        <!-- Ветка ответов второго уровня — строками ниже, с отступом слева -->
        <template v-if="isRepliesExpanded(comment.id)">
          <SC_CommentReplies v-if="getReplies(comment.id).length > 0">
            <SC_ReplyItemWrapper
              v-for="reply in getReplies(comment.id)"
              :key="reply.id"
            >
              <SC_CommentItem>
                <router-link :to="getCommentProfileLink(reply)">
                  <div v-if="getCommentAvatarUrl(reply.userprofile)" class="comment-avatar">
                    <img :src="getCommentAvatarUrl(reply.userprofile)" :alt="reply.userprofile?.name" />
                  </div>
                  <div v-else class="comment-avatar-placeholder">
                    {{ (reply.userprofile?.name || '?').charAt(0).toUpperCase() }}
                  </div>
                </router-link>
                <SC_CommentContent>
                  <SC_CommentMeta>
                    <router-link :to="getCommentProfileLink(reply)">
                      <SC_CommentAuthor>{{ reply.userprofile?.name || reply.address }}</SC_CommentAuthor>
                    </router-link>
                    <SC_CommentDate>{{ formatCommentDate(reply.time) }}</SC_CommentDate>
                  </SC_CommentMeta>
                  <SC_CommentText v-html="formatCommentMessageHtml(reply)"></SC_CommentText>
                  <SC_CommentActions>
                    <span
                      :class="['comment-score', { 'comment-score--voted': isCommentLiked(reply), 'comment-score--clickable': commentCanClickLike(reply) }]"
                      role="button"
                      tabindex="0"
                      @click.stop.prevent="onCommentScoreUp(reply)"
                    >👍 {{ reply.scoreUp ?? 0 }}</span>
                    <span
                      :class="['comment-score', { 'comment-score--voted': isCommentDisliked(reply), 'comment-score--clickable': commentCanClickDislike(reply) }]"
                      role="button"
                      tabindex="0"
                      @click.stop.prevent="onCommentScoreDown(reply)"
                    >👎 {{ reply.scoreDown ?? 0 }}</span>
                    <span
                      role="button"
                      tabindex="0"
                      @click.stop.prevent="onReplyToSecondLevel(reply)"
                    >Ответить</span>
                    <span
                      role="button"
                      tabindex="0"
                      @click.stop.prevent="onReplyToComment(reply)"
                    >Ответить автору</span>
                  </SC_CommentActions>
                </SC_CommentContent>
              </SC_CommentItem>
              <!-- Плашка ответа под комментарием второго уровня -->
              <SC_ReplyPanel v-if="isReplyPanelOpen(reply.id)">
                <div v-if="currentUserAvatarUrl" class="reply-avatar">
                  <img :src="currentUserAvatarUrl" alt="" />
                </div>
                <div v-else class="reply-avatar-placeholder">{{ currentUserInitial }}</div>
                <SC_ReplyInputWrap>
                  <SC_ReplyTextarea
                    :key="replyPanelKey"
                    ref="replyTextareaRef"
                    v-model="replyDraft"
                    placeholder="Введите ответ... (введите @ чтобы упомянуть пользователя)"
                    rows="2"
                    @input="handleReplyInput"
                    @keydown="handleReplyKeydown"
                  />
            <SC_MentionList
              ref="mentionListRef"
              v-if="showMentionList && filteredMentionUsers.length > 0"
            >
              <SC_MentionItem
                v-for="(u, idx) in filteredMentionUsers"
                :key="u.address"
                type="button"
                :class="{ 'mention-item--highlighted': mentionHighlightIndex === idx }"
                @click.stop.prevent="selectMentionUser(u)"
              >
                {{ u.name }}
              </SC_MentionItem>
            </SC_MentionList>
          </SC_ReplyInputWrap>
          <SC_ReplyCancelBtn type="button" title="Отменить" @click.stop.prevent="requestCloseReply">
                  <CloseOutlined />
                </SC_ReplyCancelBtn>
                <SC_ReplySendBtn
                  type="button"
                  title="Отправить"
                  :disabled="!(replyDraft || '').trim()"
                  @click.stop.prevent="sendReply"
                >
                  <SendOutlined />
                </SC_ReplySendBtn>
              </SC_ReplyPanel>
            </SC_ReplyItemWrapper>
          </SC_CommentReplies>
          <SC_CommentRepliesToggle
            v-if="!isRepliesLoading(comment.id)"
            type="button"
            @click.stop.prevent="toggleRepliesExpanded(comment.id)"
          >
            {{ getReplies(comment.id).length > 0 ? 'Свернуть ответы' : 'Свернуть' }}
          </SC_CommentRepliesToggle>
          <SC_CommentsLoading v-if="isRepliesLoading(comment.id)">
            <LoadingOutlined :style="{ fontSize: '16px', color: '#00a4ff' }" spin />
          </SC_CommentsLoading>
        </template>
      </SC_CommentWithReplies>

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

      <!-- Модалка подтверждения отмены ответа (если уже введён текст) -->
      <Modal
        v-model:open="showCancelReplyModal"
        title="Отменить ответ?"
        ok-text="Да, отменить"
        cancel-text="Нет"
        @ok="confirmCancelReply"
      >
        <p>Введённый текст будет удалён.</p>
      </Modal>
    </template>
  </SC_CommentsPreview>
</template>

<script>
import { postCardCommentsOptions } from './post-card-comments.ts'

export default postCardCommentsOptions
</script>
