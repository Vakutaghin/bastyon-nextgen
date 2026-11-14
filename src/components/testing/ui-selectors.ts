// Селекторы общих компонентов интерфейса для юнит- и e2e-тестов.
//
// Тесты не пишут классы библиотеки компонентов напрямую: компоненты antd
// заменяются своими, и при замене меняется только этот файл, а не десятки
// спек. Значения — строки CSS: их можно склеивать (`${UI.modal}.post-modal`) и
// передавать в page.evaluate аргументом (замыкание туда не доходит).
export const UI = {
  /** Окно — корень панели; класс окна ставится на него же: `${UI.modal}.post-modal`. */
  modal: '.ant-modal',
  /** Слой окна во весь экран: прокрутка, отступы под вырезы. */
  modalWrap: '.ant-modal-wrap',
  /** Видимая панель окна. */
  modalContent: '.ant-modal-content',
  modalBody: '.ant-modal-body',
  /** Крестик окна. */
  modalClose: '.ant-modal-close',
  /** Окно подтверждения или сообщения (confirm / info / success / error). */
  confirm: '.ant-modal-confirm',
  /** Ряд кнопок окна подтверждения. */
  confirmButtons: '.ant-modal-confirm-btns',
  /** Кнопка опасного действия (красная). */
  dangerButton: '.ant-btn-dangerous',
  /** Основная кнопка (акцентная). */
  primaryButton: '.ant-btn-primary',

  /** Элемент, открывающий выпадающее меню. */
  dropdownTrigger: '.ant-dropdown-trigger',
  /** Пункт выпадающего меню. */
  menuItem: '.ant-dropdown-menu-item',
  /** Подпись пункта меню. */
  menuItemLabel: '.ant-dropdown-menu-title-content',
  /** Иконка пункта меню. */
  menuItemIcon: '.ant-dropdown-menu-item-icon',

  /** Всплывающая панель (popover). */
  popover: '.ui-popover',
  /** Закрытая всплывающая панель (своя убирается из DOM; на время ухода — открытая). */
  popoverHidden: '[data-state="closed"]',

  /** Поле выбора (Select). */
  select: '.ant-select',
  selectDisabled: '.ant-select-disabled',
  /** Стрелка поля выбора. */
  selectArrow: '.ant-select-arrow',
  /** Вариант в открытом списке поля выбора. */
  selectOption: '.ant-select-item-option',

  /** Поле даты и времени. */
  datePicker: '.ant-picker',
  datePickerDisabled: '.ant-picker-disabled',

  /** Сам input флажка (Checkbox). */
  checkboxInput: '.ui-checkbox__input',
  /** Крестик очистки поля ввода. */
  inputClear: '.ui-input__clear',

  /** Область тостов. */
  toastHost: '.ui-toast-host',
  /** Один тост. */
  toast: '.ui-toast',
  /** Крестик тоста. */
  toastClose: '[data-testid="toast-close"]',

  /** Боковая шторка (Drawer). */
  drawer: '.ant-drawer-content',
} as const
