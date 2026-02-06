import { defineComponent, h } from 'vue'
import { Dropdown, Menu } from 'ant-design-vue'
import { CaretDownOutlined, CheckOutlined } from '@ant-design/icons-vue'
import type { MenuProps } from 'ant-design-vue'

import { logoData } from '@/b-components/header/dummy-data/logo-data'
import {
  SC_Logo,
  SC_LogoLink,
  SC_LogoImg,
  SC_LogoLang,
  SC_LanguageFlag,
  SC_LanguageName,
} from './styled'


export const headerLogoOptions = defineComponent({
  name: 'HeaderLogo',
  components: {
    Dropdown,
    Menu,
    CaretDownOutlined,
    CheckOutlined,
    SC_Logo,
    SC_LogoLink,
    SC_LogoImg,
    SC_LogoLang,
    SC_LanguageFlag,
    SC_LanguageName
  },
  data() {
    return {
      logoData
    }
  },
  computed: {
    currentLanguageName(): string {
      const lang = this.logoData.languages.find((l) => l.code === this.logoData.currentLanguage)
      return lang ? lang.name : 'Русский'
    },
    currentLanguageFlag(): string {
      const lang = this.logoData.languages.find((l) => l.code === this.logoData.currentLanguage)
      return lang ? lang.flag : '🇷🇺'
    },
    languageMenuItems(): MenuProps['items'] {
      return this.logoData.languages.map((lang) => {
        const isSelected = lang.code === this.logoData.currentLanguage
        return {
          key: lang.code,
          label: h('span', {
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%'
            }
          }, [
            h('span', { style: { fontSize: '18px', lineHeight: '1' } }, lang.flag),
            h('span', { style: { flex: '1' } }, lang.name),
            isSelected ? h(CheckOutlined, {
              style: {
                marginLeft: 'auto',
                color: '#1890ff',
                fontSize: '16px'
              }
            }) : null
          ])
        }
      })
    }
  },
  methods: {
    handleLanguageChange({ key }: { key: string }) {
      // Обновляем текущий язык
      this.logoData.currentLanguage = key
      // TODO: Здесь можно добавить логику смены языка в приложении
      // Например, вызов i18n.setLocale(key) или сохранение в localStorage
      // localStorage.setItem('language', key)
    },
    handleLogoClick() {
      this.$router.push('/')
    }
  }
})
