import { defineComponent } from 'vue'

import SidebarTabs from '@/b-components/sidebar/sidebar-tabs/sidebar-tabs.vue'
import SidebarCategories from '@/b-components/sidebar/sidebar-categories/sidebar-categories.vue'
import SidebarTags from '@/b-components/sidebar/sidebar-tags/sidebar-tags.vue'
import SidebarExplorerLink from '@/b-components/sidebar/sidebar-explorer-link/sidebar-explorer-link.vue'
import { SC_LeftSidebar } from './styled'


export const sidebarLeftOptions = defineComponent({
  name: 'SidebarLeft',
  components: {
    SidebarTabs,
    SidebarCategories,
    SidebarTags,
    SidebarExplorerLink,
    SC_LeftSidebar,
  },
  props: {
    collapsed: {
      type: Boolean,
      default: false
    }
  }
})
