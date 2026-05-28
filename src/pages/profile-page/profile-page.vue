<template>
  <SC_ProfileWork class="adj">
    <SC_ProfilePage>
      <h1 class="visually-hidden">{{ profile?.name || $route.params.userName || 'Профиль' }}</h1>
      <ProfileCover :profile="profile" />

      <SC_ProfileContentWrapper>
        <ProfileSidebar :profile="profile" />

        <SC_ProfileMainContent>
          <SC_LoadingProfile v-if="loading">
            <Spin tip="Загрузка профиля...">
              <template #indicator>
                <LoadingOutlined :style="{ fontSize: '40px', color: 'rgb(0, 123, 255)' }" spin />
              </template>
            </Spin>
          </SC_LoadingProfile>

          <SC_ErrorProfile v-else-if="error">
            {{ error }}
          </SC_ErrorProfile>

          <SC_PendingProfile v-else-if="isOwnPendingProfile">
            <div class="pending-icon">
              <ClockCircleOutlined />
            </div>
            <div class="pending-title">Регистрация в процессе</div>
            <div>
              Ваш аккаунт проходит регистрацию в блокчейне. Обычно это занимает несколько минут.
              После завершения профиль станет полностью доступен.
            </div>
          </SC_PendingProfile>

          <div v-else-if="userAddress">
            <ProfileFeed
              :address="userAddress"
              :profile="profile"
              :lang="''"
              @profile-loaded="onProfileLoaded"
            />
          </div>
        </SC_ProfileMainContent>
      </SC_ProfileContentWrapper>
    </SC_ProfilePage>
  </SC_ProfileWork>
</template>

<script lang="ts">
import profilePage from './profile-page'

export default profilePage
</script>
