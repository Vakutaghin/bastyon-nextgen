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

            <SC_CommentDate :title="lastCommentDateFull">{{ lastCommentDateOnly }}</SC_CommentDate>
          </SC_CommentMeta>

          <SC_CommentText v-html="lastCommentMessageHtml"></SC_CommentText>

          <SC_CommentActions>
            <span
              :class="['comment-score', { 'comment-score--voted': lastCommentUserLiked, 'comment-score--clickable': lastCommentCanClickLike }]"
              role="button"
              tabindex="0"
              @click.stop.prevent="onLastCommentScoreUp()"
            >👍 {{ formatScore(post.lastComment?.scoreUp) }}</span>

            <span
              :class="['comment-score', { 'comment-score--voted': lastCommentUserDisliked, 'comment-score--clickable': lastCommentCanClickDislike }]"
              role="button"
              tabindex="0"
              @click.stop.prevent="onLastCommentScoreDown()"
            >👎 {{ formatScore(post.lastComment?.scoreDown) }}</span>
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
          <SC_ReplyItemWrapper
            v-for="reply in getReplies(lastCommentId)"
            :key="reply.id"
          >
            <SC_CommentItem :class="{ 'is-pending': isCommentPending(reply) }">
              <CommentAvatar
                :url="getCommentAvatarUrl(reply.userprofile)"
                :name="reply.userprofile?.name || '?'"
              />
              <SC_CommentContent>
                <SC_CommentMeta>
                  <SC_CommentAuthor>{{ reply.userprofile?.name || reply.address }}</SC_CommentAuthor>
                  <SC_CommentMetaRight>
                    <SC_CommentDate :title="formatCommentDateFull(reply.time)">{{ formatCommentDate(reply.time) }}</SC_CommentDate>
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
          <CommentAvatar :url="lastCommentAvatarUrl" :name="post.lastComment.authorName" />
        </router-link>

        <SC_CommentContent>
          <SC_CommentMeta>
            <router-link :to="lastCommentProfileLink">
              <SC_CommentAuthor>{{ post.lastComment.authorName }}</SC_CommentAuthor>
            </router-link>

            <SC_CommentDate :title="lastCommentDateFull">{{ lastCommentDateOnly }}</SC_CommentDate>
          </SC_CommentMeta>

          <SC_CommentText v-html="lastCommentMessageHtml"></SC_CommentText>

          <SC_CommentActions>
            <span
              :class="['comment-score', { 'comment-score--voted': lastCommentUserLiked, 'comment-score--clickable': lastCommentCanClickLike }]"
              role="button"
              tabindex="0"
              @click.stop.prevent="onLastCommentScoreUp()"
            >👍 {{ formatScore(post.lastComment?.scoreUp) }}</span>
            <span
              :class="['comment-score', { 'comment-score--voted': lastCommentUserDisliked, 'comment-score--clickable': lastCommentCanClickDislike }]"
              role="button"
              tabindex="0"
              @click.stop.prevent="onLastCommentScoreDown()"
            >👎 {{ formatScore(post.lastComment?.scoreDown) }}</span>
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
          <SC_ReplyItemWrapper
            v-for="reply in getReplies(lastCommentId)"
            :key="reply.id"
          >
            <SC_CommentItem :class="{ 'is-pending': isCommentPending(reply) }">
              <CommentAvatar
                :url="getCommentAvatarUrl(reply.userprofile)"
                :name="reply.userprofile?.name || '?'"
              />
              <SC_CommentContent>
                <SC_CommentMeta>
                  <SC_CommentAuthor>{{ reply.userprofile?.name || reply.address }}</SC_CommentAuthor>
                  <SC_CommentMetaRight>
                    <SC_CommentDate :title="formatCommentDateFull(reply.time)">{{ formatCommentDate(reply.time) }}</SC_CommentDate>
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
                <SC_CommentText v-html="formatCommentMessageHtml(reply)"></SC_CommentText>
              </SC_CommentContent>
            </SC_CommentItem>
          </SC_ReplyItemWrapper>
        </SC_CommentReplies>
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

      <SC_CommentWithReplies
        v-for="comment in visibleComments"
        :key="comment.id"
      >
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
                <SC_CommentAuthor>{{ comment.userprofile?.name || comment.address }}</SC_CommentAuthor>
              </router-link>
              <SC_CommentMetaRight>
                <SC_CommentDate :title="formatCommentDateFull(comment.time)">{{ formatCommentDate(comment.time) }}</SC_CommentDate>
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
              <SC_RevealBtn
                type="button"
                @click.stop.prevent="revealHiddenComment(comment)"
              >
                Показать всё равно
              </SC_RevealBtn>
            </SC_HiddenBanner>
            <SC_CommentText
              v-else
              v-html="formatCommentMessageHtml(comment)"
            ></SC_CommentText>

            <SC_CommentImages
              v-if="!isCommentDeleted(comment) && !isEditingComment(comment) && !shouldHideContent(comment) && getCommentImagesList(comment).length > 0"
            >
              <PostCardImages :images="getCommentImagesList(comment)" />
            </SC_CommentImages>

            <SC_CommentActions v-if="canInteractWithComment(comment) && !isEditingComment(comment) && !shouldHideContent(comment)">
              <span
                :class="['comment-score', { 'comment-score--voted': isCommentLiked(comment), 'comment-score--clickable': commentCanClickLike(comment) }]"
                role="button"
                tabindex="0"
                @click.stop.prevent="onCommentScoreUp(comment)"
              >👍 {{ formatScore(comment.scoreUp) }}</span>

              <span
                :class="['comment-score', { 'comment-score--voted': isCommentDisliked(comment), 'comment-score--clickable': commentCanClickDislike(comment) }]"
                role="button"
                tabindex="0"
                @click.stop.prevent="onCommentScoreDown(comment)"
              >👎 {{ formatScore(comment.scoreDown) }}</span>
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
            <SC_ReplyItemWrapper
              v-for="reply in getReplies(comment.id)"
              :key="reply.id"
            >
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
                      <SC_CommentAuthor>{{ reply.userprofile?.name || reply.address }}</SC_CommentAuthor>
                    </router-link>
                    <SC_CommentMetaRight>
                      <SC_CommentDate :title="formatCommentDateFull(reply.time)">{{ formatCommentDate(reply.time) }}</SC_CommentDate>
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
                    <SC_RevealBtn
                      type="button"
                      @click.stop.prevent="revealHiddenComment(reply)"
                    >
                      Показать всё равно
                    </SC_RevealBtn>
                  </SC_HiddenBanner>
                  <SC_CommentText
                    v-else
                    v-html="formatCommentMessageHtml(reply)"
                  ></SC_CommentText>
                  <SC_CommentImages
                    v-if="!isCommentDeleted(reply) && !isEditingComment(reply) && !shouldHideContent(reply) && getCommentImagesList(reply).length > 0"
                  >
                    <PostCardImages :images="getCommentImagesList(reply)" />
                  </SC_CommentImages>
                  <SC_CommentActions v-if="canInteractWithComment(reply) && !isEditingComment(reply) && !shouldHideContent(reply)">
                    <span
                      :class="['comment-score', { 'comment-score--voted': isCommentLiked(reply), 'comment-score--clickable': commentCanClickLike(reply) }]"
                      role="button"
                      tabindex="0"
                      @click.stop.prevent="onCommentScoreUp(reply)"
                    >👍 {{ formatScore(reply.scoreUp) }}</span>
                    <span
                      :class="['comment-score', { 'comment-score--voted': isCommentDisliked(reply), 'comment-score--clickable': commentCanClickDislike(reply) }]"
                      role="button"
                      tabindex="0"
                      @click.stop.prevent="onCommentScoreDown(reply)"
                    >👎 {{ formatScore(reply.scoreDown) }}</span>
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

        <SC_ShowCommentsBtnCollapse
          type="button"
          @click.stop.prevent="collapseComments"
        >
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
          @input="(e) => { if (isRootReplyActive) handleRootReplyInput(e) }"
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
        :disabled="!isRootReplyActive || !(replyDraft || '').trim() || replySubmitting || !rootLengthValid"
        @click.stop.prevent="sendReply"
      >
        <LoadingOutlined v-if="replySubmitting" :style="{ fontSize: '14px' }" spin />
        <SendOutlined v-else />
      </SC_ReplySendBtn>
    </SC_ReplyPanel>
  </SC_CommentsPreview>
</template>

<script>
import { postCardCommentsOptions } from './post-card-comments.ts'

export default postCardCommentsOptions
</script>
