<template>
  <SC_ProfileCover :hasImage="!!displayImage">
    <SC_CoverImage v-if="displayImage" :image="displayImage" :isBlur="isBlur" />
  </SC_ProfileCover>
</template>

<script lang="ts">
import ProfileCover from './profile-cover.ts'
export default ProfileCover
</script>
