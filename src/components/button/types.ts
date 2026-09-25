export interface ButtonProps {
  /**
   * `link` — только текст акцентом; `text` — «призрачная» кнопка (ghost у
   * Nuxt UI): без рамки, подложка на hover.
   */
  type?: 'primary' | 'secondary' | 'danger' | 'default' | 'link' | 'text'
  size?: 'large' | 'middle' | 'small'
  disabled?: boolean
  loading?: boolean
  danger?: boolean
  block?: boolean
  /** С `type="primary"` — прозрачная кнопка с акцентной рамкой (outline у Nuxt UI). */
  ghost?: boolean
  htmlType?: 'button' | 'submit' | 'reset'
}
