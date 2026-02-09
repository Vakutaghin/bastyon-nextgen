<template>
  <SC_ProfileWork class='adj'>
    <SC_ProfilePage>
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

          <div v-else-if="userAddress">
            <ProfileFeed
              :address="userAddress"
              :profile="profile"
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
