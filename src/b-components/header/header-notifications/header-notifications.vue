<template>
  <Dropdown
    v-if="isAuthenticated"
    v-model:open="visible"
    :trigger="['click']"
    placement="bottomRight"
    :getPopupContainer="getPopupContainer"
    overlay-class-name="header-notifications-dropdown"
    :overlay-style="{ zIndex: 3000 }"
    @openChange="onOpenChange"
  >
    <SC_NotificationsWrapper>
      <Badge
        :count="unreadCount"
        :offset="[0, 5]"
        :number-style="{ backgroundColor: '#1890ff' }"
      >
        <BellOutlined :style="{ fontSize: '20px' }" />
      </Badge>
    </SC_NotificationsWrapper>

    <template #overlay>
      <SC_NotificationsMenu @click.stop @mousedown.stop>
        <SC_NotificationsHeader>
          <SC_NotificationsTitle>Уведомления</SC_NotificationsTitle>
          <SC_NotificationsHeaderActions v-if="list.length > 0">
            <SC_ClearAllButton type="button" @click.stop="onClearAll">
              Убрать все
            </SC_ClearAllButton>
          </SC_NotificationsHeaderActions>
        </SC_NotificationsHeader>

        <SC_EnrichingHint v-if="isEnriching && list.length > 0" />

        <SC_LoaderWrap v-if="isLoading && list.length === 0">
          Загрузка...
        </SC_LoaderWrap>
        <SC_EmptyMessage v-else-if="list.length === 0">
          Нет новых уведомлений
        </SC_EmptyMessage>
        <SC_NotificationsList v-else>
          <SC_NotificationItem
            v-for="item in list"
            :key="item.id"
            :seen="isSeen(item)"
          >
            <SC_NotificationItemBody @click="onItemClick(item)">
              <SC_NotificationHead>
                <SC_NotificationTypePill :variant="item.type">
                  <component :is="iconFor(item)" />
                  <span>{{ getTypeLabel(item) }}</span>
                </SC_NotificationTypePill>
                <SC_NotificationItemTime>{{ formatTime(item) }}</SC_NotificationItemTime>
              </SC_NotificationHead>

              <SC_NotificationActor>
                <SC_NotificationAvatar v-if="getAvatar(item)">
                  <img :src="getAvatar(item)" :alt="getDisplayName(item)" />
                </SC_NotificationAvatar>
                <SC_NotificationAvatarLetter v-else>{{ getInitial(item) }}</SC_NotificationAvatarLetter>

                <SC_NotificationActorText>
                  <SC_NotificationActorName>{{ getDisplayName(item) }}</SC_NotificationActorName>
                  <SC_NotificationAction>{{ getActionLine(item) }}</SC_NotificationAction>
                </SC_NotificationActorText>
              </SC_NotificationActor>

              <SC_NotificationPreview v-if="hasPreview(item)" :variant="item.type">
                <SC_RatingValue
                  v-if="item.type === 'rating' && item.upvoteVal != null"
                  :positive="getRatingDisplay(item).positive"
                >
                  {{ getRatingDisplay(item).label }}
                </SC_RatingValue>

                <SC_CommentPreview
                  v-if="getCommentText(item)"
                  :expanded="isExpanded(item.id)"
                >{{ getCommentDisplay(item) }}</SC_CommentPreview>

                <SC_ExpandToggle
                  v-if="isCommentLong(item)"
                  type="button"
                  @click.stop="toggleExpand(item.id)"
                >
                  {{ isExpanded(item.id) ? 'Свернуть' : 'Показать полностью' }}
                </SC_ExpandToggle>

                <SC_PostRef v-if="getPostCaption(item)">
                  <SC_PostRefLabel>Пост:</SC_PostRefLabel>
                  <SC_PostRefText>{{ getPostCaption(item) }}</SC_PostRefText>
                </SC_PostRef>
              </SC_NotificationPreview>
            </SC_NotificationItemBody>

            <SC_NotificationItemActions @click.stop>
              <Dropdown
                trigger="click"
                placement="bottomRight"
                :getPopupContainer="getPopupContainerInner"
              >
                <SC_NotificationItemTrigger><EllipsisOutlined /></SC_NotificationItemTrigger>
                <template #overlay>
                  <Menu
                    :items="[{ key: item.id, label: 'Скрыть уведомление' }]"
                    @click="onItemMenuClick"
                  />
                </template>
              </Dropdown>
            </SC_NotificationItemActions>
          </SC_NotificationItem>
        </SC_NotificationsList>
      </SC_NotificationsMenu>
    </template>
  </Dropdown>
</template>

<script>
import { headerNotificationsOptions } from './header-notifications.ts'
import {
  SC_NotificationsWrapper,
  SC_NotificationsMenu,
  SC_NotificationsHeader,
  SC_NotificationsTitle,
  SC_NotificationsHeaderActions,
  SC_ClearAllButton,
  SC_NotificationsList,
  SC_NotificationItem,
  SC_NotificationItemBody,
  SC_NotificationItemActions,
  SC_NotificationItemTrigger,
  SC_NotificationItemTime,
  SC_NotificationHead,
  SC_NotificationTypePill,
  SC_NotificationActor,
  SC_NotificationAvatar,
  SC_NotificationAvatarLetter,
  SC_NotificationActorText,
  SC_NotificationActorName,
  SC_NotificationAction,
  SC_NotificationPreview,
  SC_RatingValue,
  SC_CommentPreview,
  SC_ExpandToggle,
  SC_PostRef,
  SC_PostRefLabel,
  SC_PostRefText,
  SC_EmptyMessage,
  SC_LoaderWrap,
  SC_EnrichingHint
} from './styled.ts'

export default {
  ...headerNotificationsOptions,
  components: {
    ...headerNotificationsOptions.components,
    SC_NotificationsWrapper,
    SC_NotificationsMenu,
    SC_NotificationsHeader,
    SC_NotificationsTitle,
    SC_NotificationsHeaderActions,
    SC_ClearAllButton,
    SC_NotificationsList,
    SC_NotificationItem,
    SC_NotificationItemBody,
    SC_NotificationItemActions,
    SC_NotificationItemTrigger,
    SC_NotificationItemTime,
    SC_NotificationHead,
    SC_NotificationTypePill,
    SC_NotificationActor,
    SC_NotificationAvatar,
    SC_NotificationAvatarLetter,
    SC_NotificationActorText,
    SC_NotificationActorName,
    SC_NotificationAction,
    SC_NotificationPreview,
    SC_RatingValue,
    SC_CommentPreview,
    SC_ExpandToggle,
    SC_PostRef,
    SC_PostRefLabel,
    SC_PostRefText,
    SC_EmptyMessage,
    SC_LoaderWrap,
    SC_EnrichingHint
  }
}
</script>
