export interface ButtonProps {
  /** `link` — только текст акцентом, без рамки и подложки. */
  type?: 'primary' | 'secondary' | 'danger' | 'default' | 'link'
  size?: 'large' | 'middle' | 'small'
  disabled?: boolean
  loading?: boolean
  danger?: boolean
  block?: boolean
  htmlType?: 'button' | 'submit' | 'reset'
}
