<template>
  <SC_HelpWork>
    <SC_HelpPage>
      <SC_State v-if="page.failed.value">
        {{ t('help.loadFailed') }}
        <div>
          <SC_ToolButton type="button" @click="page.retry">{{ t('help.retry') }}</SC_ToolButton>
        </div>
      </SC_State>
      <SC_State v-else-if="!library">{{ t('help.loading') }}</SC_State>

      <template v-else>
        <!-- Панель инструментов окна справки: назад, вперёд, домой, скрыть навигатор. -->
        <SC_Toolbar v-if="!mobile">
          <SC_ToolButton
            type="button"
            :disabled="!page.canBack.value"
            :aria-label="t('help.toolbar.back')"
            :title="t('help.toolbar.back')"
            @click="page.back"
          >
            <LeftOutlined />
          </SC_ToolButton>
          <SC_ToolButton
            type="button"
            :disabled="!page.canForward.value"
            :aria-label="t('help.toolbar.forward')"
            :title="t('help.toolbar.forward')"
            @click="page.forward"
          >
            <RightOutlined />
          </SC_ToolButton>
          <SC_ToolButton
            type="button"
            :aria-label="t('help.toolbar.home')"
            :title="t('help.toolbar.home')"
            @click="goHome"
          >
            <HomeOutlined />
          </SC_ToolButton>
          <SC_ToolButton
            type="button"
            :aria-label="navLabel"
            :title="navLabel"
            @click="help.setNavHidden(!help.navHidden)"
          >
            <MenuUnfoldOutlined v-if="help.navHidden" />
            <MenuFoldOutlined v-else />
          </SC_ToolButton>
          <SC_ToolbarSpacer />
          <SC_ToolButton v-if="page.highlighted.value" type="button" @click="page.clearHighlight">
            <CloseOutlined />
            {{ t('help.toolbar.clearHighlight') }}
          </SC_ToolButton>
          <SC_ToolButton
            v-if="topicId"
            type="button"
            :class="{ active: favorite }"
            :aria-label="favoriteLabel"
            :title="favoriteLabel"
            :aria-pressed="favorite"
            @click="toggleFavorite"
          >
            <StarFilled v-if="favorite" />
            <StarOutlined v-else />
          </SC_ToolButton>
          <SC_ToolButton
            type="button"
            :aria-label="t('help.toolbar.copyLink')"
            :title="t('help.toolbar.copyLink')"
            @click="page.copyLink"
          >
            <LinkIcon />
          </SC_ToolButton>
        </SC_Toolbar>

        <!-- Телефон: навигатор — первый экран, статья — второй. -->
        <SC_MobileBar v-else-if="topicId">
          <SC_ToolButton type="button" @click="goHome">
            <LeftOutlined />
            {{ t('help.toolbar.toNavigator') }}
          </SC_ToolButton>
          <SC_ToolbarSpacer />
          <SC_ToolButton
            v-if="page.highlighted.value"
            type="button"
            :aria-label="t('help.toolbar.clearHighlight')"
            :title="t('help.toolbar.clearHighlight')"
            @click="page.clearHighlight"
          >
            <CloseOutlined />
          </SC_ToolButton>
          <SC_ToolButton
            type="button"
            :class="{ active: favorite }"
            :aria-label="favoriteLabel"
            :aria-pressed="favorite"
            @click="toggleFavorite"
          >
            <StarFilled v-if="favorite" />
            <StarOutlined v-else />
          </SC_ToolButton>
          <SC_ToolButton
            type="button"
            :aria-label="t('help.toolbar.copyLink')"
            @click="page.copyLink"
          >
            <LinkIcon />
          </SC_ToolButton>
        </SC_MobileBar>

        <template v-if="mobile && !topicId">
          <HelpHome :library="library" compact />
          <SC_Nav>
            <HelpNavigator />
          </SC_Nav>
        </template>

        <SC_Layout v-else :class="{ 'nav-hidden': help.navHidden || mobile }">
          <SC_Nav v-if="!mobile && !help.navHidden">
            <HelpNavigator />
          </SC_Nav>
          <SC_Main>
            <HelpArticle v-if="topic" :key="topic.id" :topic="topic" :library="library" />
            <SC_State v-else-if="topicId">
              {{ t('help.notFound') }}
              <div>
                <SC_ToolButton type="button" @click="goHome">{{ t('help.toHome') }}</SC_ToolButton>
              </div>
            </SC_State>
            <HelpHome v-else :library="library" />
          </SC_Main>
        </SC_Layout>
      </template>
    </SC_HelpPage>
  </SC_HelpWork>
</template>

<script setup lang="ts">
// Справка — раздел в духе CHM: навигатор с вкладками «Содержание»,
// «Указатель», «Поиск», «Избранное» слева, статья справа, над ними панель
// «Назад / Вперёд / Домой». Статьи — help/<язык>/*.md (формат — help/README.md).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  CloseOutlined,
  HomeOutlined,
  LeftOutlined,
  LinkIcon,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  RightOutlined,
  StarFilled,
  StarOutlined,
} from '@/components/icons'
import HelpArticle from '@/b-components/help/help-article.vue'
import { SC_State } from '@/b-components/help/styled'
import { useViewport } from '@/composables/use-viewport'
import { useHelpStore } from '@/stores/help-store'
import HelpHome from './components/help-home.vue'
import HelpNavigator from './components/help-navigator.vue'
import { useHelpPage } from './use-help-page'
import {
  SC_HelpPage,
  SC_HelpWork,
  SC_Layout,
  SC_Main,
  SC_MobileBar,
  SC_Nav,
  SC_ToolbarSpacer,
  SC_Toolbar,
  SC_ToolButton,
} from './help-page.styled'

const { t } = useI18n()
const router = useRouter()
const help = useHelpStore()
const { isMobileOrTablet: mobile } = useViewport()
const page = useHelpPage()

const library = computed(() => page.library.value)
const topic = computed(() => page.topic.value)
const topicId = computed(() => page.topicId.value)
const favorite = computed(() => !!topicId.value && help.isFavorite(topicId.value))
const favoriteLabel = computed(() =>
  t(favorite.value ? 'help.toolbar.removeFavorite' : 'help.toolbar.addFavorite')
)
const navLabel = computed(() => t(help.navHidden ? 'help.toolbar.showNav' : 'help.toolbar.hideNav'))

function toggleFavorite(): void {
  if (topicId.value) help.toggleFavorite(topicId.value)
}

function goHome(): void {
  void router.push('/help')
}
</script>
