<template>
  <InputSearch
    v-model:value='searchQuery'
    :placeholder='searchData.placeholder'
    :maxlength='searchData.maxLength'
    allow-clear
    autocomplete='off'
    autocorrect='off'
    autocapitalize='off'
    spellcheck='false'
    @input='onSearchInput'
    @search='onSearch'
  />
</template>

<script>
import { headerSearchOptions } from './header-search.ts'

export default headerSearchOptions
</script>

