<template>
  <SC_Tags>
    <SC_TagsHeader @click="toggleExpanded" style="cursor: pointer;">
      <SC_TagsTitle>Актуальные теги</SC_TagsTitle>
      <SC_TagsControls v-if="hasSelection">
        <SC_TagsReset @click.stop="clearSelection" title="Сбросить теги">
          <StopOutlined />
        </SC_TagsReset>
      </SC_TagsControls>
      <SC_TagsToggle
        v-if='showToggle'
      >
        <CaretUpOutlined v-if='isExpanded' />
        <CaretDownOutlined v-else />
      </SC_TagsToggle>
    </SC_TagsHeader>

    <SC_TagsLoading v-if='isLoading'>
      <Spin size='small'>
        <template #indicator>
          <LoadingOutlined :style="{ fontSize: '24px', color: 'rgb(0, 123, 255)' }" spin />
        </template>
      </Spin>
    </SC_TagsLoading>
    <SC_TagsList v-else-if='!error && visibleTags.length > 0'>
      <SC_TagsItem
        v-for='tag in visibleTags'
        :key='tag.id'
        :selected="isTagSelected(tag.name)"
        type='button'
        @click='selectTag(tag.name)'
      >
        <SC_TagsName>#{{ tag.name }}</SC_TagsName>
        <SC_TagsCount>{{ formatCount(tag.count) }}</SC_TagsCount>
      </SC_TagsItem>
    </SC_TagsList>
  </SC_Tags>
</template>

<script>
import { sidebarTagsOptions } from './sidebar-tags.ts'

export default sidebarTagsOptions
</script>
