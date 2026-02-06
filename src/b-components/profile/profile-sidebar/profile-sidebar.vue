<template>
  <SC_ProfileSidebar>
    <div v-if="profile">
      <SC_UserAvatar v-if="userAvatar">
        <img :src="userAvatar" :alt="displayName" />
      </SC_UserAvatar>
      <SC_UserAvatarPlaceholder v-else>
        {{ userInitial }}
      </SC_UserAvatarPlaceholder>

      <SC_UserName>{{ displayName }}</SC_UserName>

      <SC_UserStats>
        <SC_StatItem>
          <SC_StatLabel>Репутация</SC_StatLabel>
          <SC_StatValue>{{ formattedReputation }}</SC_StatValue>
        </SC_StatItem>

        <SC_StatItem>
          <SC_StatLabel>Подписчики</SC_StatLabel>
          <SC_StatValue>{{ profile.subscribers_count || 0 }}</SC_StatValue>
        </SC_StatItem>

        <SC_StatItem>
          <SC_StatLabel>Подписки</SC_StatLabel>
          <SC_StatValue>{{ profile.subscribes_count || 0 }}</SC_StatValue>
        </SC_StatItem>
      </SC_UserStats>

      <!-- Тут давай сделаем кнопку, которая позволит начать чат с пользователем, чью страницу мы смотрим -->

      <SC_UserAbout v-if="formattedUserAbout">
        <h3>Информация</h3>

        <p v-html="formattedUserAbout"></p>
        <hr />

        <SC_UserAddress v-if="userAddress" @click="copyAddress" title="Copy address">
          {{ userAddress }}
        </SC_UserAddress>

        <SC_UserSite v-if="userSite" :href="userSite" target="_blank">
          {{ userSite }}
        </SC_UserSite>

        <div>
          <span>Публикации: </span>
          <strong>{{ profile.publications_count || 0 }}</strong>
        </div>

        <div v-if="profile.regdate">
          <span>Регистрация: <strong>{{ formattedDate }}</strong></span>
        </div>
      </SC_UserAbout>
    </div>

    <SC_LoadingState v-else>
      <Spin>
        <template #indicator>
          <LoadingOutlined :style="{ fontSize: '24px', color: 'rgb(0, 123, 255)' }" spin />
        </template>
      </Spin>
    </SC_LoadingState>
  </SC_ProfileSidebar>
</template>

<script lang="ts">
import ProfileSidebar from './profile-sidebar.ts'
export default ProfileSidebar
</script>
