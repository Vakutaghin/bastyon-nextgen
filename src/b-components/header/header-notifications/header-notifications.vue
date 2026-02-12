<template>
  <Dropdown
    v-if="isAuthenticated"
    v-model:open="visible"
    :trigger="['click']"
    placement="bottomRight"
    :getPopupContainer="(trigger) => trigger.closest('header') || document.body"
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
        </SC_NotificationsHeader>

        <SC_LoaderWrap v-if="isLoading">
          Загрузка...
        </SC_LoaderWrap>
        <SC_EmptyMessage v-else-if="list.length === 0">
          Нет новых уведомлений
        </SC_EmptyMessage>
        <SC_NotificationsList v-else>
          <SC_NotificationItem
            v-for="item in list"
            :key="item.id"
            :$seen="item.seen"
            @click="onItemClick(item)"
          >
            <SC_NotificationItemTitle>{{ item.title }}</SC_NotificationItemTitle>
            <SC_NotificationItemDesc v-if="item.description">
              {{ item.description }}
            </SC_NotificationItemDesc>
            <SC_NotificationItemTime>{{ formatTime(item) }}</SC_NotificationItemTime>
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
  SC_NotificationsList,
  SC_NotificationItem,
  SC_NotificationItemTitle,
  SC_NotificationItemDesc,
  SC_NotificationItemTime,
  SC_EmptyMessage,
  SC_LoaderWrap
} from './styled.ts'

export default {
  ...headerNotificationsOptions,
  components: {
    ...headerNotificationsOptions.components,
    SC_NotificationsWrapper,
    SC_NotificationsMenu,
    SC_NotificationsHeader,
    SC_NotificationsTitle,
    SC_NotificationsList,
    SC_NotificationItem,
    SC_NotificationItemTitle,
    SC_NotificationItemDesc,
    SC_NotificationItemTime,
    SC_EmptyMessage,
    SC_LoaderWrap
  }
}
</script>
