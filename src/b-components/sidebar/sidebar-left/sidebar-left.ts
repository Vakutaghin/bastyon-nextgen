import { defineComponent } from 'vue'

import SidebarTabs from '@/b-components/sidebar/sidebar-tabs/sidebar-tabs.vue'
import SidebarCategories from '@/b-components/sidebar/sidebar-categories/sidebar-categories.vue'
import SidebarTags from '@/b-components/sidebar/sidebar-tags/sidebar-tags.vue'
import { SC_LeftSidebar } from './styled'


export const sidebarLeftOptions = defineComponent({
  name: 'SidebarLeft',
  components: {
    SidebarTabs,
    SidebarCategories,
    SidebarTags,
    SC_LeftSidebar,
  }
})
