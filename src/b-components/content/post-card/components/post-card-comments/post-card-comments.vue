<template>
  <SC_CommentsPreview>
    <h3>Комментарии ({{ totalCommentsCount }})</h3>

    <!-- Компактный вид: комментарии ещё не загружены -->
    <template v-if="!allComments">
      <SC_CommentWithReplies v-if="hasUserComments">
        <SC_CommentItem>
          <router-link :to="lastCommentProfileLink">
            <CommentAvatar :url="lastCommentAvatarUrl" :name="post.lastComment.authorName" />
          </router-link>

          <SC_CommentContent>
            <SC_CommentMeta>
              <router-link :to="lastCommentProfileLink">
                <SC_CommentAuthor>{{ post.lastComment.authorName }}</SC_CommentAuthor>
              </router-link>

              <SC_CommentDate :title="lastCommentDateFull">{{
                lastCommentDateOnly
              }}</SC_CommentDate>
            </SC_CommentMeta>

            <!-- eslint-disable-next-line vue/no-v-text-v-html-on-component -->
            <SC_CommentText v-html="lastCommentMessageHtml"></SC_CommentText>

            <SC_CommentActions>
              <button
                type="button"
                :class="[
                  'comment-score',
                  {
                    'comment-score--voted': lastCommentUserLiked,
                    'comment-score--clickable': lastCommentCanClickLike,
                  },
                ]"
                @click.stop.prevent="onLastCommentScoreUp()"
              >
                👍 {{ formatScore(post.lastComment?.scoreUp) }}
              </button>

              <button
                type="button"
                :class="[
                  'comment-score',
                  {
                    'comment-score--voted': lastCommentUserDisliked,
                    'comment-score--clickable': lastCommentCanClickDislike,
                  },
                ]"
                @click.stop.prevent="onLastCommentScoreDown()"
              >
                👎 {{ formatScore(post.lastComment?.scoreDown) }}
              </button>
              <SC_CommentRepliesLink
                v-if="lastCommentChildren > 0"
                type="button"
                @click.stop.prevent="onLastCommentRepliesClick"
              >
                Ответы ({{ lastCommentChildren }})
              </SC_CommentRepliesLink>
              <button type="button" @click.stop.prevent="onLastCommentReply">Ответить</button>
              <button type="button" @click.stop.prevent="onLastCommentReplyToAuthor">
                Ответить автору
              </button>
            </SC_CommentActions>
          </SC_CommentContent>
        </SC_CommentItem>
        <SC_ReplyPanelNested v-if="lastCommentId && isReplyPanelOpen(lastCommentId)">
          <CommentReplyPanel
            :current-user-avatar-url="currentUserAvatarUrl"
            :current-user-initial="currentUserInitial"
            v-model:show-cancel-modal="showCancelReplyModal"
            v-model:reply-draft="replyDraft"
            :reply-panel-key="replyPanelKey"
            :reply-submitting="replySubmitting"
            :show-mention-list="showMentionList"
            :filtered-mention-users="filteredMentionUsers"
            :mention-highlight-index="mentionHighlightIndex"
            @confirm-cancel="confirmCancelReply"
            @input="handleReplyInput"
            @keydown="handleReplyKeydown"
            @select-mention="selectMentionUser"
            @request-close="requestCloseReply"
            @send="sendReply"
          />
        </SC_ReplyPanelNested>
        <!-- Оптимистично-добавленные pending-ответы к lastComment.
             В компактном виде real-ответы не подгружаются (клик «Ответы» переключает в развёрнутый),
             поэтому getReplies здесь возвращает только pending — это и показываем. -->
        <SC_CommentReplies v-if="lastCommentId && getReplies(lastCommentId).length > 0">
          <SC_ReplyItemWrapper v-for="reply in getReplies(lastCommentId)" :key="reply.id">
            <SC_CommentItem :class="{ 'is-pending': isCommentPending(reply) }">
              <CommentAvatar
                :url="getCommentAvatarUrl(reply.userprofile)"
                :name="reply.userprofile?.name || '?'"
              />
              <SC_CommentContent>
                <SC_CommentMeta>
                  <SC_CommentAuthor>{{
                    reply.userprofile?.name || reply.address
                  }}</SC_CommentAuthor>
                  <SC_CommentMetaRight>
                    <SC_CommentDate :title="formatCommentDateFull(reply.time)">{{
                      formatCommentDate(reply.time)
                    }}</SC_CommentDate>
                    <SC_TxStatusBadge
                      v-if="isCommentPending(reply)"
                      title="Ожидает подтверждения сетью"
                    >
                      <ClockCircleOutlined />
                      <span>Ожидание</span>
                    </SC_TxStatusBadge>
                    <SC_TxStatusBadge
                      v-else-if="isCommentRejected(reply)"
                      class="tx-status--rejected"
                      title="Транзакция отклонена"
                    >
                      <StopOutlined />
                      <span>Ошибка</span>
                    </SC_TxStatusBadge>
                  </SC_CommentMetaRight>
                </SC_CommentMeta>
                <!-- eslint-disable-next-line vue/no-v-text-v-html-on-component -->
                <SC_CommentText v-html="formatCommentMessageHtml(reply)"></SC_CommentText>
              </SC_CommentContent>
            </SC_CommentItem>
          </SC_ReplyItemWrapper>
        </SC_CommentReplies>
      </SC_CommentWithReplies>

      <SC_CommentsActionsRow v-if="totalCommentsCount > 0">
        <SC_CommentsActionsLeft>
          <SC_CommentsLoading v-if="allCommentsLoading">
            <LoadingOutlined :style="{ fontSize: '18px', color: '#00a4ff' }" spin />
          </SC_CommentsLoading>

          <template v-else>
            <SC_ShowCommentsBtn type="button" @click.stop.prevent="loadAllComments(false)">
              Показать ещё 15
            </SC_ShowCommentsBtn>

            <SC_ShowCommentsBtnSecondary type="button" @click.stop.prevent="loadAllComments(true)">
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
            <CommentAvatar :url="lastCommentAvatarUrl" :name="post.lastComment.authorName" />
          </router-link>

          <SC_CommentContent>
            <SC_CommentMeta>
              <router-link :to="lastCommentProfileLink">
                <SC_CommentAuthor>{{ post.lastComment.authorName }}</SC_CommentAuthor>
              </router-link>

              <SC_CommentDate :title="lastCommentDateFull">{{
                lastCommentDateOnly
              }}</SC_CommentDate>
            </SC_CommentMeta>

            <!-- eslint-disable-next-line vue/no-v-text-v-html-on-component -->
            <SC_CommentText v-html="lastCommentMessageHtml"></SC_CommentText>

            <SC_CommentActions>
              <button
                type="button"
                :class="[
                  'comment-score',
                  {
                    'comment-score--voted': lastCommentUserLiked,
                    'comment-score--clickable': lastCommentCanClickLike,
                  },
                ]"
                @click.stop.prevent="onLastCommentScoreUp()"
              >
                👍 {{ formatScore(post.lastComment?.scoreUp) }}
              </button>
              <button
                type="button"
                :class="[
                  'comment-score',
                  {
                    'comment-score--voted': lastCommentUserDisliked,
                    'comment-score--clickable': lastCommentCanClickDislike,
                  },
                ]"
                @click.stop.prevent="onLastCommentScoreDown()"
              >
                👎 {{ formatScore(post.lastComment?.scoreDown) }}
              </button>
              <SC_CommentRepliesLink
                v-if="lastCommentChildren > 0"
                type="button"
                @click.stop.prevent="onLastCommentRepliesClick"
              >
                Ответы ({{ lastCommentChildren }})
              </SC_CommentRepliesLink>
              <button type="button" @click.stop.prevent="onLastCommentReply">Ответить</button>
              <button type="button" @click.stop.prevent="onLastCommentReplyToAuthor">
                Ответить автору
              </button>
            </SC_CommentActions>
          </SC_CommentContent>
        </SC_CommentItem>
        <SC_ReplyPanelNested v-if="lastCommentId && isReplyPanelOpen(lastCommentId)">
          <CommentReplyPanel
            :current-user-avatar-url="currentUserAvatarUrl"
            :current-user-initial="currentUserInitial"
            v-model:show-cancel-modal="showCancelReplyModal"
            v-model:reply-draft="replyDraft"
            :reply-panel-key="replyPanelKey"
            :reply-submitting="replySubmitting"
            :show-mention-list="showMentionList"
            :filtered-mention-users="filteredMentionUsers"
            :mention-highlight-index="mentionHighlightIndex"
            @confirm-cancel="confirmCancelReply"
            @input="handleReplyInput"
            @keydown="handleReplyKeydown"
            @select-mention="selectMentionUser"
            @request-close="requestCloseReply"
            @send="sendReply"
          />
        </SC_ReplyPanelNested>
        <!-- Оптимистично-добавленные pending-ответы к lastComment в свёрнутом виде.
             Аналогично первому компактному шаблону: getReplies возвращает только pending. -->
        <SC_CommentReplies v-if="lastCommentId && getReplies(lastCommentId).length > 0">
          <SC_ReplyItemWrapper v-for="reply in getReplies(lastCommentId)" :key="reply.id">
            <SC_CommentItem :class="{ 'is-pending': isCommentPending(reply) }">
              <CommentAvatar
                :url="getCommentAvatarUrl(reply.userprofile)"
                :name="reply.userprofile?.name || '?'"
              />
              <SC_CommentContent>
                <SC_CommentMeta>
                  <SC_CommentAuthor>{{
                    reply.userprofile?.name || reply.address
                  }}</SC_CommentAuthor>
                  <SC_CommentMetaRight>
                    <SC_CommentDate :title="formatCommentDateFull(reply.time)">{{
                      formatCommentDate(reply.time)
                    }}</SC_CommentDate>
                    <SC_TxStatusBadge
                      v-if="isCommentPending(reply)"
                      title="Ожидает подтверждения сетью"
                    >
                      <ClockCircleOutlined />
                      <span>Ожидание</span>
                    </SC_TxStatusBadge>
                    <SC_TxStatusBadge
                      v-else-if="isCommentRejected(reply)"
                      class="tx-status--rejected"
                      title="Транзакция отклонена"
                    >
                      <StopOutlined />
                      <span>Ошибка</span>
                    </SC_TxStatusBadge>
                  </SC_CommentMetaRight>
                </SC_CommentMeta>
                <!-- eslint-disable-next-line vue/no-v-text-v-html-on-component -->
                <SC_CommentText v-html="formatCommentMessageHtml(reply)"></SC_CommentText>
              </SC_CommentContent>
            </SC_CommentItem>
          </SC_ReplyItemWrapper>
        </SC_CommentReplies>
      </SC_CommentWithReplies>

      <SC_ShowCommentsBtn type="button" @click.stop.prevent="expandComments">
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
        <SC_RefreshBtn
          type="button"
          :disabled="allCommentsLoading"
          title="Обновить"
          @click.stop.prevent="refreshComments"
        >
          <LoadingOutlined v-if="allCommentsLoading" :style="{ fontSize: '14px' }" spin />
          <SyncOutlined v-else />
        </SC_RefreshBtn>
      </SC_CommentsSortRow>

      <SC_CommentWithReplies v-for="comment in visibleComments" :key="comment.id">
        <SC_CommentRow :class="{ 'is-pending': isCommentPending(comment) }">
          <router-link :to="getCommentProfileLink(comment)">
            <CommentAvatar
              :url="getCommentAvatarUrl(comment.userprofile)"
              :name="comment.userprofile?.name || '?'"
            />
          </router-link>

          <SC_CommentContent>
            <SC_CommentMeta>
              <router-link :to="getCommentProfileLink(comment)">
                <SC_CommentAuthor>{{
                  comment.userprofile?.name || comment.address
                }}</SC_CommentAuthor>
              </router-link>
              <SC_CommentMetaRight>
                <SC_CommentDate :title="formatCommentDateFull(comment.time)">{{
                  formatCommentDate(comment.time)
                }}</SC_CommentDate>
                <SC_TxStatusBadge
                  v-if="isCommentPending(comment)"
                  title="Ожидает подтверждения сетью"
                >
                  <ClockCircleOutlined />
                  <span>Ожидание</span>
                </SC_TxStatusBadge>
                <SC_TxStatusBadge
                  v-else-if="isCommentRejected(comment)"
                  class="tx-status--rejected"
                  title="Транзакция отклонена"
                >
                  <StopOutlined />
                  <span>Ошибка</span>
                </SC_TxStatusBadge>
                <SC_EditedMark
                  v-else-if="!isCommentDeleted(comment) && isCommentEdited(comment)"
                  title="Отредактировано"
                >
                  <EditOutlined />
                </SC_EditedMark>
                <CommentMenu
                  v-if="canShowMenu(comment)"
                  :can-edit="canEditComment(comment)"
                  :can-delete="canDeleteComment(comment)"
                  @action="(a) => onCommentMenuAction(comment, a)"
                />
              </SC_CommentMetaRight>
            </SC_CommentMeta>

            <SC_CommentDeleted v-if="isCommentDeleted(comment)">
              Комментарий был удалён
            </SC_CommentDeleted>
            <CommentEditForm
              v-else-if="isEditingComment(comment)"
              :edit-draft="editDraft"
              :initial-draft="editInitialDraft"
              :edit-submitting="editSubmitting"
              @update:edit-draft="(v) => (editDraft = v)"
              @request-close="requestCloseEdit"
              @save="submitEdit"
            />
            <SC_HiddenBanner v-else-if="shouldHideContent(comment)">
              <span>Скрыто из-за низкой репутации автора</span>
              <SC_RevealBtn type="button" @click.stop.prevent="revealHiddenComment(comment)">
                Показать всё равно
              </SC_RevealBtn>
            </SC_HiddenBanner>
            <!-- eslint-disable-next-line vue/no-v-text-v-html-on-component -->
            <SC_CommentText v-else v-html="formatCommentMessageHtml(comment)"></SC_CommentText>

            <SC_CommentImages
              v-if="
                !isCommentDeleted(comment) &&
                !isEditingComment(comment) &&
                !shouldHideContent(comment) &&
                getCommentImagesList(comment).length > 0
              "
            >
              <PostCardImages :images="getCommentImagesList(comment)" />
            </SC_CommentImages>

            <SC_CommentActions
              v-if="
                canInteractWithComment(comment) &&
                !isEditingComment(comment) &&
                !shouldHideContent(comment)
              "
            >
              <button
                type="button"
                :class="[
                  'comment-score',
                  {
                    'comment-score--voted': isCommentLiked(comment),
                    'comment-score--clickable': commentCanClickLike(comment),
                  },
                ]"
                @click.stop.prevent="onCommentScoreUp(comment)"
              >
                👍 {{ formatScore(comment.scoreUp) }}
              </button>

              <button
                type="button"
                :class="[
                  'comment-score',
                  {
                    'comment-score--voted': isCommentDisliked(comment),
                    'comment-score--clickable': commentCanClickDislike(comment),
                  },
                ]"
                @click.stop.prevent="onCommentScoreDown(comment)"
              >
                👎 {{ formatScore(comment.scoreDown) }}
              </button>
              <SC_CommentRepliesLink
                v-if="(comment.children ?? 0) > 0"
                type="button"
                @click.stop.prevent="onRepliesClick(comment)"
              >
                Ответы ({{ comment.children }})
              </SC_CommentRepliesLink>
              <button type="button" @click.stop.prevent="onReplyToFirstLevel(comment)">
                Ответить
              </button>
              <button type="button" @click.stop.prevent="onReplyToAuthorFirstLevel(comment)">
                Ответить автору
              </button>
            </SC_CommentActions>
          </SC_CommentContent>
        </SC_CommentRow>

        <!-- Плашка ответа под комментарием первого уровня -->
        <SC_ReplyPanelNested v-if="isReplyPanelOpen(comment.id)">
          <CommentReplyPanel
            :current-user-avatar-url="currentUserAvatarUrl"
            :current-user-initial="currentUserInitial"
            v-model:show-cancel-modal="showCancelReplyModal"
            v-model:reply-draft="replyDraft"
            :reply-panel-key="replyPanelKey"
            :reply-submitting="replySubmitting"
            :show-mention-list="showMentionList"
            :filtered-mention-users="filteredMentionUsers"
            :mention-highlight-index="mentionHighlightIndex"
            @confirm-cancel="confirmCancelReply"
            @input="handleReplyInput"
            @keydown="handleReplyKeydown"
            @select-mention="selectMentionUser"
            @request-close="requestCloseReply"
            @send="sendReply"
          />
        </SC_ReplyPanelNested>

        <!-- Ветка ответов второго уровня -->
        <template v-if="isRepliesExpanded(comment.id)">
          <SC_CommentReplies v-if="getReplies(comment.id).length > 0">
            <SC_ReplyItemWrapper v-for="reply in getReplies(comment.id)" :key="reply.id">
              <SC_CommentItem :class="{ 'is-pending': isCommentPending(reply) }">
                <router-link :to="getCommentProfileLink(reply)">
                  <CommentAvatar
                    :url="getCommentAvatarUrl(reply.userprofile)"
                    :name="reply.userprofile?.name || '?'"
                  />
                </router-link>
                <SC_CommentContent>
                  <SC_CommentMeta>
                    <router-link :to="getCommentProfileLink(reply)">
                      <SC_CommentAuthor>{{
                        reply.userprofile?.name || reply.address
                      }}</SC_CommentAuthor>
                    </router-link>
                    <SC_CommentMetaRight>
                      <SC_CommentDate :title="formatCommentDateFull(reply.time)">{{
                        formatCommentDate(reply.time)
                      }}</SC_CommentDate>
                      <SC_TxStatusBadge
                        v-if="isCommentPending(reply)"
                        title="Ожидает подтверждения сетью"
                      >
                        <ClockCircleOutlined />
                        <span>Ожидание</span>
                      </SC_TxStatusBadge>
                      <SC_TxStatusBadge
                        v-else-if="isCommentRejected(reply)"
                        class="tx-status--rejected"
                        title="Транзакция отклонена"
                      >
                        <StopOutlined />
                        <span>Ошибка</span>
                      </SC_TxStatusBadge>
                      <SC_EditedMark
                        v-else-if="!isCommentDeleted(reply) && isCommentEdited(reply)"
                        title="Отредактировано"
                      >
                        <EditOutlined />
                      </SC_EditedMark>
                      <CommentMenu
                        v-if="canShowMenu(reply)"
                        :can-edit="canEditComment(reply)"
                        :can-delete="canDeleteComment(reply)"
                        @action="(a) => onCommentMenuAction(reply, a)"
                      />
                    </SC_CommentMetaRight>
                  </SC_CommentMeta>
                  <SC_CommentDeleted v-if="isCommentDeleted(reply)">
                    Комментарий был удалён
                  </SC_CommentDeleted>
                  <CommentEditForm
                    v-else-if="isEditingComment(reply)"
                    :edit-draft="editDraft"
                    :initial-draft="editInitialDraft"
                    :edit-submitting="editSubmitting"
                    @update:edit-draft="(v) => (editDraft = v)"
                    @request-close="requestCloseEdit"
                    @save="submitEdit"
                  />
                  <SC_HiddenBanner v-else-if="shouldHideContent(reply)">
                    <span>Скрыто из-за низкой репутации автора</span>
                    <SC_RevealBtn type="button" @click.stop.prevent="revealHiddenComment(reply)">
                      Показать всё равно
                    </SC_RevealBtn>
                  </SC_HiddenBanner>
                  <!-- eslint-disable-next-line vue/no-v-text-v-html-on-component -->
                  <SC_CommentText v-else v-html="formatCommentMessageHtml(reply)"></SC_CommentText>
                  <SC_CommentImages
                    v-if="
                      !isCommentDeleted(reply) &&
                      !isEditingComment(reply) &&
                      !shouldHideContent(reply) &&
                      getCommentImagesList(reply).length > 0
                    "
                  >
                    <PostCardImages :images="getCommentImagesList(reply)" />
                  </SC_CommentImages>
                  <SC_CommentActions
                    v-if="
                      canInteractWithComment(reply) &&
                      !isEditingComment(reply) &&
                      !shouldHideContent(reply)
                    "
                  >
                    <button
                      type="button"
                      :class="[
                        'comment-score',
                        {
                          'comment-score--voted': isCommentLiked(reply),
                          'comment-score--clickable': commentCanClickLike(reply),
                        },
                      ]"
                      @click.stop.prevent="onCommentScoreUp(reply)"
                    >
                      👍 {{ formatScore(reply.scoreUp) }}
                    </button>
                    <button
                      type="button"
                      :class="[
                        'comment-score',
                        {
                          'comment-score--voted': isCommentDisliked(reply),
                          'comment-score--clickable': commentCanClickDislike(reply),
                        },
                      ]"
                      @click.stop.prevent="onCommentScoreDown(reply)"
                    >
                      👎 {{ formatScore(reply.scoreDown) }}
                    </button>
                    <button type="button" @click.stop.prevent="onReplyToSecondLevel(reply)">
                      Ответить
                    </button>
                    <button type="button" @click.stop.prevent="onReplyToComment(reply)">
                      Ответить автору
                    </button>
                  </SC_CommentActions>
                </SC_CommentContent>
              </SC_CommentItem>
              <!-- Плашка ответа под комментарием второго уровня -->
              <SC_ReplyPanelNestedLevel2 v-if="isReplyPanelOpen(reply.id)">
                <CommentReplyPanel
                  :current-user-avatar-url="currentUserAvatarUrl"
                  :current-user-initial="currentUserInitial"
                  v-model:show-cancel-modal="showCancelReplyModal"
                  v-model:reply-draft="replyDraft"
                  :reply-panel-key="replyPanelKey"
                  :reply-submitting="replySubmitting"
                  :show-mention-list="showMentionList"
                  :filtered-mention-users="filteredMentionUsers"
                  :mention-highlight-index="mentionHighlightIndex"
                  @confirm-cancel="confirmCancelReply"
                  @input="handleReplyInput"
                  @keydown="handleReplyKeydown"
                  @select-mention="selectMentionUser"
                  @request-close="requestCloseReply"
                  @send="sendReply"
                />
              </SC_ReplyPanelNestedLevel2>
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

        <SC_ShowCommentsBtnCollapse type="button" @click.stop.prevent="collapseComments">
          Свернуть
        </SC_ShowCommentsBtnCollapse>
      </SC_CommentsActionsRow>
    </template>

    <!-- Запрет публикации (лимит/репутация/удалённый аккаунт/не авторизован) -->
    <SC_ComposerDisabled v-if="composerDisableReason">
      {{ composerDisableReason.message }}
    </SC_ComposerDisabled>

    <!-- Бар «написать комментарий к посту» -->
    <SC_ReplyPanel v-else-if="isRootReplyActive">
      <div v-if="currentUserAvatarUrl" class="reply-avatar">
        <img :src="currentUserAvatarUrl" alt="" />
      </div>
      <div v-else class="reply-avatar-placeholder">{{ currentUserInitial }}</div>
      <SC_ReplyInputWrap>
        <SC_ReplyTextarea
          :key="'root-' + replyPanelKey"
          ref="rootReplyTextareaRef"
          :value="isRootReplyActive ? replyDraft : ''"
          placeholder="Введите комментарий... (введите @ чтобы упомянуть пользователя)"
          rows="2"
          @input="
            (e) => {
              if (isRootReplyActive) handleRootReplyInput(e)
            }
          "
          @focus="onRootBarFocus"
          @keydown="handleReplyKeydown"
        />
        <SC_MentionList
          ref="rootMentionListRef"
          v-if="showMentionList && filteredMentionUsers.length > 0 && isRootReplyActive"
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
        <SC_LengthCounter
          v-if="isRootReplyActive && rootLengthHint"
          :class="{ 'length-counter--bad': rootLengthHint.isOver }"
        >
          {{ rootLengthHint.text }}
        </SC_LengthCounter>
      </SC_ReplyInputWrap>
      <SC_ReplySendBtn
        type="button"
        title="Отправить"
        :disabled="
          !isRootReplyActive || !(replyDraft || '').trim() || replySubmitting || !rootLengthValid
        "
        @click.stop.prevent="sendReply"
      >
        <LoadingOutlined v-if="replySubmitting" :style="{ fontSize: '14px' }" spin />
        <SendOutlined v-else />
      </SC_ReplySendBtn>
    </SC_ReplyPanel>
  </SC_CommentsPreview>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import {
  LoadingOutlined,
  CloseOutlined,
  SendOutlined,
  EditOutlined,
  ClockCircleOutlined,
  StopOutlined,
  SyncOutlined,
} from '@ant-design/icons-vue'
import { useAuthStore } from '@/blockchain'
import { useCommentsStore } from '@/stores'
import { resolveImageUrl } from '@/helpers/common/url-transformer'
import { formatRelativeTime } from '@/helpers/common/date-formatter'
import type { GetComment } from '@/types/rpc-responses/get-comments'
import type { PostForComments } from './types'
import type { CommentMenuAction } from './comment-menu.vue'
import CommentAvatar from './comment-avatar.vue'
import CommentReplyPanel from './comment-reply-panel.vue'
import CommentMenu from './comment-menu.vue'
import CommentEditForm from './comment-edit-form.vue'
import PostCardImages from '@/b-components/content/post-card/components/post-card-images/post-card-images.vue'
import {
  formatCommentMessageHtml as formatCommentMessageHtmlRaw,
  getCommentAvatarUrl,
  getCommentProfileLink,
  getInitial,
  formatCommentDateAndTime,
  getCommentImages,
  compressedNumber,
} from './helpers'
import { getCommentPostingDisableReason, type DisableReason } from './visibility'
import {
  SC_CommentsPreview,
  SC_CommentItem,
  SC_CommentRow,
  SC_CommentWithReplies,
  SC_CommentAuthor,
  SC_CommentText,
  SC_CommentContent,
  SC_CommentMeta,
  SC_CommentMetaRight,
  SC_CommentDate,
  SC_CommentImages,
  SC_CommentDeleted,
  SC_HiddenBanner,
  SC_RevealBtn,
  SC_ComposerDisabled,
  SC_EditedMark,
  SC_TxStatusBadge,
  SC_CommentActions,
  SC_CommentRepliesLink,
  SC_CommentReplies,
  SC_CommentRepliesToggle,
  SC_ReplyItemWrapper,
  SC_ReplyPanel,
  SC_ReplyPanelNested,
  SC_ReplyPanelNestedLevel2,
  SC_ReplyInputWrap,
  SC_ReplyTextarea,
  SC_MentionList,
  SC_MentionItem,
  SC_ReplySendBtn,
  SC_LengthCounter,
  SC_ShowCommentsBtn,
  SC_ShowCommentsBtnSecondary,
  SC_ShowCommentsBtnCollapse,
  SC_CommentsActionsRow,
  SC_CommentsActionsLeft,
  SC_CommentsLoading,
  SC_CommentsSortRow,
  SC_CommentsSortSelect,
  SC_RefreshBtn,
} from './styled'
import {
  buildSortedComments,
  buildMentionUsers,
  filterMentionUsers,
} from './helpers/comments-computed'
import { pendingToGetComment } from './helpers/pending-comments'
import { useCommentsLoader } from './composables/use-comments-loader'
import { useCommentsReplies } from './composables/use-comments-replies'
import { useCommentsScoring } from './composables/use-comments-scoring'
import { useCommentForm } from './composables/use-comment-form'
import { useCommentEditDelete } from './composables/use-comment-edit-delete'
import { useCommentVisibility } from './composables/use-comment-visibility'
import { useCommentsWs } from './composables/use-comments-ws'

export type { PostForComments }

const props = defineProps<{ post: PostForComments }>()

const emit = defineEmits<{
  collapsed: []
  replyToComment: []
  comment: []
}>()

// --- Базовая идентификация поста / пользователя. ---
const postId = computed<string>(
  () => props.post.txid || props.post.hash || String(props.post.id || '')
)

const currentUserAddress = computed<string>(() => {
  const addr = useAuthStore().getUserAddress
  return typeof addr === 'string' ? addr : ''
})

const postAuthorAddress = computed<string>(() => {
  const p = props.post as PostForComments & { address?: string }
  return typeof p?.address === 'string' ? p.address : ''
})

const isUserAuthenticated = computed<boolean>(() => useAuthStore().isUserAuthenticated)

const currentUserStateData = computed<import('@/types/rpc-responses/user-state').UserState | null>(
  () => {
    const profile = useAuthStore().getUserProfile as
      | (import('@/types/rpc-responses/user-state').UserState & { reputation?: number })
      | null
    return profile ?? null
  }
)

const composerDisableReason = computed<DisableReason | null>(() =>
  getCommentPostingDisableReason(isUserAuthenticated.value, currentUserStateData.value)
)

// --- Тик для реактивного обновления относительного времени (раз в минуту). ---
const nowTick = ref(0)
const relativeTimer = window.setInterval(() => {
  nowTick.value++
}, 60_000)

// --- Композаблы. ---
// Forward-ref на sorted comments — нужен для loader (visibleCount учитывает pending).
// Заполняется ниже после создания computed sortedComments.
let sortedCommentsRef: { value: GetComment[] } = { value: [] }
const loader = useCommentsLoader({
  postId,
  getSortedLength: () => sortedCommentsRef.value.length,
})

const replies = useCommentsReplies({ postId })

const scoring = useCommentsScoring({
  post: computed(() => props.post),
  isUserAuthenticated,
  currentUserStateData,
})

const editDelete = useCommentEditDelete({
  postId,
  currentUserAddress,
  postAuthorAddress,
  allComments: loader.allComments,
  repliesByParentId: replies.repliesByParentId,
})

const visibility = useCommentVisibility({
  currentUserAddress,
  isDeleted: editDelete.isCommentDeleted,
})

// --- Вычисляемые списки. ---
const pendingRootComments = computed<GetComment[]>(() => {
  const list = useCommentsStore().getPendingForPost(postId.value)
  if (!list.length) return []
  return list.filter((p) => !p.parentId).map((p) => pendingToGetComment(p))
})

const sortedComments = computed<GetComment[]>(() =>
  buildSortedComments(
    loader.allComments.value,
    pendingRootComments.value,
    loader.commentsSortOrder.value,
    currentUserAddress.value || undefined,
    postAuthorAddress.value || undefined
  )
)
// Прокидываем актуальный массив в forward-ref для loader.getSortedLength.
sortedCommentsRef = {
  get value() {
    return sortedComments.value
  },
} as unknown as { value: GetComment[] }

const visibleComments = computed<GetComment[]>(() =>
  sortedComments.value.slice(0, loader.visibleCommentsCount.value)
)

const remainingCommentsCount = computed<number>(() =>
  Math.max(0, sortedComments.value.length - loader.visibleCommentsCount.value)
)

const nextCommentsPageSize = computed<number>(() => {
  if (remainingCommentsCount.value <= 0) return 0
  // COMMENTS_PAGE_SIZE используется в loader; дублирование захардкодом здесь
  // дешевле, чем поднимать из consts ради одного computed.
  return Math.min(20, remainingCommentsCount.value)
})

const hasMoreCommentsToShow = computed<boolean>(() => remainingCommentsCount.value > 0)

const totalCommentsCount = computed<number>(() => props.post.comments ?? 0)
const actualCommentsCount = computed<number>(() => loader.allComments.value?.length ?? 0)
const hasUserComments = computed<boolean>(() => {
  const lc = props.post.lastComment
  return !!lc && !!lc.message && (props.post.comments || 0) > 0
})

// --- Last comment отображение. ---
const lastCommentMessageHtml = computed<string>(() =>
  formatCommentMessageHtmlRaw({ msg: props.post.lastComment?.message || '' } as GetComment)
)
const lastCommentProfileLink = computed<string>(() => {
  const lc = props.post.lastComment
  if (!lc) return '/'
  if (lc.address) return '/' + lc.address
  const name = (lc.authorName || '').toLowerCase()
  if (name) return '/' + name
  return '/'
})
const lastCommentAvatarUrl = computed<string | null>(() => {
  const img = props.post.lastComment?.avatar || null
  if (!img) return null
  return resolveImageUrl(img) || null
})
const lastCommentInitial = computed<string>(() => getInitial(props.post.lastComment?.authorName))
const lastCommentDateOnly = computed<string>(() => {
  // Зависимость от тика, чтобы относительное время авто-обновлялось каждую минуту.
  void nowTick.value
  return formatRelativeTime(props.post.lastComment?.time || 0)
})
const lastCommentDateFull = computed<string>(() =>
  formatCommentDateAndTime(props.post.lastComment?.time || 0)
)
const lastCommentId = computed<string | null>(() => props.post.lastComment?.id ?? null)
const lastCommentChildren = computed<number>(() => props.post.lastComment?.children ?? 0)

// --- Текущий пользователь — аватар/инициал. ---
const currentUserAvatarUrl = computed<string | null>(() => {
  const url = useAuthStore().getUserAvatarUrl
  if (!url) return null
  return resolveImageUrl(url) || null
})
const currentUserInitial = computed<string>(() => {
  const profile = useAuthStore().getUserProfile as { name?: string } | null
  const name = profile?.name
  if (name) return name.charAt(0).toUpperCase()
  const addr = useAuthStore().getUserAddress
  if (addr && typeof addr === 'string') return addr.charAt(0).toUpperCase()
  return '?'
})

// --- @mention candidates. ---
const mentionUsers = computed(() =>
  buildMentionUsers(props.post, loader.allComments.value, replies.repliesByParentId.value)
)

// --- Template refs для form composable. ---
const rootMentionListRef = ref<unknown>(null)
const mentionListRef = ref<unknown>(null)
const rootReplyTextareaRef = ref<unknown>(null)
const replyTextareaRef = ref<unknown>(null)

// form composable нужен filteredMentionUsers (вынесен сюда, потому что
// зависит от mentionQuery, которое живёт внутри form composable —
// форвардим через ref-прокси).
const mentionQueryProxy = ref('')
const filteredMentionUsers = computed(() =>
  filterMentionUsers(mentionUsers.value, mentionQueryProxy.value)
)

const form = useCommentForm({
  postId,
  currentUserAddress,
  composerDisableReason,
  allComments: loader.allComments,
  visibleCommentsCount: loader.visibleCommentsCount,
  commentsCollapsed: loader.commentsCollapsed,
  repliesExpanded: replies.repliesExpanded,
  refreshAllComments: () => loader.loadAllComments(false),
  emitComment: () => emit('comment'),
  rootMentionListRef,
  mentionListRef,
  rootReplyTextareaRef,
  replyTextareaRef,
  filteredMentionUsers,
})

// Синхронизация mentionQuery формы с прокси (для computed filtered).
Object.defineProperty(mentionQueryProxy, 'value', {
  get: () => form.mentionQuery.value,
  set: (v: string) => {
    form.mentionQuery.value = v
  },
})

// --- WS (требует уже инициализированный loader). ---
const ws = useCommentsWs({
  postId,
  isLoading: loader.allCommentsLoading,
  hasLoaded: computed(
    () => loader.allComments.value !== null
  ) as unknown as import('vue').Ref<boolean>,
  isCollapsed: loader.commentsCollapsed,
  reload: () => loader.loadAllComments(false),
})

// --- LastComment handlers (UI-события). ---
async function onLastCommentRepliesClick(): Promise<void> {
  const id = props.post.lastComment?.id
  if (!id) return
  if (!loader.allComments.value) {
    await loader.loadAllComments(false)
  } else if (loader.commentsCollapsed.value) {
    loader.expandComments()
  }
  replies.repliesExpanded.value = { ...replies.repliesExpanded.value, [id]: true }
  await replies.loadReplies(id)
}

function onLastCommentReply(): void {
  const id = props.post.lastComment?.id
  if (!id) return
  form.openReplyEmpty(id, id)
}
function onLastCommentReplyToAuthor(): void {
  const lc = props.post.lastComment
  if (!lc?.id) return
  form.openReplyToAuthor(lc.id, lc.id, lc.authorName || lc.address || '')
}

function collapseComments(): void {
  loader.collapseComments()
  emit('collapsed')
}

// --- Display helpers (методы для шаблона). ---
function formatCommentDate(time: number): string {
  void nowTick.value
  return formatRelativeTime(time)
}
function formatCommentDateFull(time: number): string {
  return formatCommentDateAndTime(time)
}
function getCommentImagesList(comment: GetComment): string[] {
  return getCommentImages(comment)
}

function formatScore(n: number | undefined | null): string {
  if (n === undefined || n === null || !Number.isFinite(n) || n === 0) return '0'
  return compressedNumber(n) || String(n)
}

function formatCommentMessageHtml(comment: GetComment): string {
  const overridden = useCommentsStore().editedMessages[comment.id]
  if (typeof overridden === 'string') {
    const patched = {
      ...comment,
      msg: JSON.stringify({ message: overridden, url: '', images: [], info: '' }),
    } as GetComment
    return formatCommentMessageHtmlRaw(patched)
  }
  return formatCommentMessageHtmlRaw(comment)
}
function isCommentEdited(comment: GetComment): boolean {
  if (typeof useCommentsStore().editedMessages[comment.id] === 'string') return true
  return !!comment.edit || comment.timeUpd > comment.time
}

// --- Menu action handler. ---
function onCommentMenuAction(comment: GetComment, action: CommentMenuAction): void {
  if (action === 'delete') {
    editDelete.confirmDeleteComment(comment)
    return
  }
  if (action === 'edit') {
    editDelete.openEditComment(comment)
    return
  }
}

// --- Cleanup. ---
onBeforeUnmount(() => {
  clearInterval(relativeTimer)
})

// Деструктурируем композаблы в плоские const'ы — Vue в template распакует ref'ы автоматически.
const {
  allComments,
  allCommentsLoading,
  allCommentsError,
  visibleCommentsCount,
  commentsCollapsed,
  commentsSortOrder,
  loadAllComments,
  expandComments,
  setCommentsSortOrder,
  showMoreComments,
  showAllComments,
} = loader

const {
  repliesByParentId,
  repliesLoading,
  repliesExpanded,
  loadReplies,
  toggleRepliesExpanded,
  isRepliesExpanded,
  isRepliesLoading,
  getReplies,
  onRepliesClick,
} = replies

const {
  lastCommentVote,
  commentVotes,
  commentScoreSubmitting,
  scoringDisableReason,
  lastCommentUserLiked,
  lastCommentUserDisliked,
  lastCommentCanClickLike,
  lastCommentCanClickDislike,
  isCommentLiked,
  isCommentDisliked,
  commentCanClickLike,
  commentCanClickDislike,
  onLastCommentScoreUp,
  onLastCommentScoreDown,
  onCommentScoreUp,
  onCommentScoreDown,
} = scoring

const {
  replyTarget,
  replyDraft,
  showCancelReplyModal,
  showMentionList,
  mentionQuery,
  mentionHighlightIndex,
  replySubmitting,
  replyPanelKey,
  isRootReplyActive,
  rootLengthHint,
  rootLengthValid,
  isReplyPanelOpen,
  openReplyToPost,
  openReplyEmpty,
  openReplyToAuthor,
  requestCloseReply,
  closeReply,
  confirmCancelReply,
  onRootBarFocus,
  handleRootReplyInput,
  handleReplyInput,
  handleReplyKeydown,
  scrollMentionHighlightIntoView,
  selectMentionUser,
  sendReply,
  onReplyToFirstLevel,
  onReplyToAuthorFirstLevel,
  onReplyToSecondLevel,
  onReplyToComment,
} = form

const { isCommentHiddenByVisibility, isHiddenRevealed, shouldHideContent, revealHiddenComment } =
  visibility

const {
  commentDeleteSubmitting,
  editingCommentId,
  editDraft,
  editInitialDraft,
  editSubmitting,
  isCommentDeleted,
  canEditComment,
  canDeleteComment,
  canShowMenu,
  isCommentPending,
  isCommentRejected,
  canInteractWithComment,
  isEditingComment,
  confirmDeleteComment,
  openEditComment,
  requestCloseEdit,
  closeEdit,
  submitEdit,
  getCommentMessagePlain,
} = editDelete

const refreshComments = ws.refresh
</script>
