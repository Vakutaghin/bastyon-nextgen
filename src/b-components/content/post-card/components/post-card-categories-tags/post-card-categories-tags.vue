<template>
  <SC_PostCategoriesAndTags v-if="displayItems && displayItems.length">
    <template v-for="item in displayItems" :key="item.id || item.name">
      <Tag
        v-if="item.type === 'category'"
        style="cursor: pointer;"
        @click.stop.prevent="handleTagClick(item)"
      >
        {{ item.icon }} {{ item.name }}
      </Tag>
      <Tag
        v-else
        style="cursor: pointer;"
        @click.stop.prevent="handleTagClick(item)"
      >
        #{{ item.name }}
      </Tag>
    </template>
  </SC_PostCategoriesAndTags>
</template>

<script>
import { postCardCategoriesTagsOptions } from './post-card-categories-tags.ts'

export default postCardCategoriesTagsOptions
</script>
