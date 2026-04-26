export interface ButtonProps {
  type?: 'primary' | 'secondary' | 'danger' | 'default'
  size?: 'large' | 'middle' | 'small'
  disabled?: boolean
  loading?: boolean
  danger?: boolean
  block?: boolean
  htmlType?: 'button' | 'submit' | 'reset'
}
