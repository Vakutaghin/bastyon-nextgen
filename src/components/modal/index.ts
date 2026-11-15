import ModalComponent from './modal.vue'
import { confirm, error, info, success, warning } from './dialogs'

/**
 * Окно и окна вопроса из кода в одном имени, как у antd: `<Modal>` в шаблоне
 * и `Modal.confirm({ … })` в коде — перевод файла с antd меняет только импорт.
 */
const Modal = Object.assign(ModalComponent, { confirm, info, success, error, warning })

export default Modal
export { SC_ModalActions, SC_ModalBody, SC_ModalIconRow } from './styled'
export { confirm, error, info, setDialogAppContext, success, warning } from './dialogs'
export type { DialogContent, DialogHandle, DialogKind, DialogOptions } from './dialog-types'
export type { ModalProps } from './types'
