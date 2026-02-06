<template>
  <SC_Categories>
    <SC_TopFirstWrapper>
      <SC_TopFirstLabel>Сначала лучшее</SC_TopFirstLabel>
      <ASwitch :checked="topFirst" @change="toggleTopFirst" size="small" />
    </SC_TopFirstWrapper>

    <SC_CategoriesHeader @click='toggleExpanded'>
      <SC_CategoriesTitle>Категории</SC_CategoriesTitle>

      <SC_CategoriesControls>
        <SC_ControlBtn @click.stop="openModal" title="Добавить категорию">
          <PlusOutlined />
        </SC_ControlBtn>

        <SC_ControlBtn v-if="hasSelection" @click.stop="clearSelection" title="Сбросить фильтр">
          <StopOutlined />
        </SC_ControlBtn>
      </SC_CategoriesControls>

      <SC_CategoriesToggle>
        <CaretUpOutlined v-if='isExpanded' />
        <CaretDownOutlined v-else />
      </SC_CategoriesToggle>
    </SC_CategoriesHeader>

    <SC_CategoriesList>
      <SC_CategoriesItem
        v-for='category in visibleCategories'
        :key='category.id'
        :selected="category.selected"
        @click='toggleCategory(category.id)'
      >
        <SC_CategoriesIcon :selected="category.selected">
          {{ category.icon }}
        </SC_CategoriesIcon>

        <SC_CategoriesName :selected="category.selected">
          {{ category.name }}
        </SC_CategoriesName>

        <!-- Кнопка удаления для кастомных/временных категорий -->
        <div
          v-if="category.isRemovable"
          @click="(e) => removeCategory(e, category.id)"
          style="margin-left: auto; padding: 0 5px; opacity: 0.6; cursor: pointer;"
        >
          <CloseOutlined style="font-size: 10px;" />
        </div>
      </SC_CategoriesItem>
    </SC_CategoriesList>

    <AModal
      v-model:open="isModalVisible"
      title="Добавить категорию"
      @ok="addCategory"
      @cancel="closeModal"
      okText="Добавить"
      cancelText="Отмена"
      :bodyStyle="{ padding: '20px' }"
      :width="400"
    >
      <div style="margin-bottom: 10px; font-size: 13px; color: #888;">
        Введите тег (буквы, цифры, _):
      </div>

      <AInput
        v-model:value="newCategoryName"
        placeholder="Например: crypto_news"
        @input="handleInput"
        @pressEnter="addCategory"
        allowClear
      />
    </AModal>

    <AModal
      v-model:open="isDeleteModalVisible"
      title="Удалить категорию?"
      @ok="confirmDeleteCategory"
      @cancel="closeDeleteModal"
      okText="Удалить"
      okType="danger"
      cancelText="Отмена"
      :width="400"
    >
      <div style="display: flex; align-items: center; gap: 12px; padding: 10px 0;">
        <ExclamationCircleOutlined style="font-size: 22px; color: #faad14;" />
        <span>Вы уверены, что хотите удалить эту категорию?</span>
      </div>
    </AModal>
  </SC_Categories>
</template>

<script>
import { sidebarCategoriesOptions } from './sidebar-categories.ts'

export default sidebarCategoriesOptions
</script>
