// Селекторы общих компонентов интерфейса для юнит- и e2e-тестов.
//
// Тесты не пишут классы библиотеки компонентов напрямую: компоненты antd
// заменяются своими, и при замене меняется только этот файл, а не десятки
// спек. Значения — строки CSS: их можно склеивать (`${UI.modal}.post-modal`) и
// передавать в page.evaluate аргументом (замыкание туда не доходит).
export const UI = {
  /** Окно — корень панели; класс окна ставится на него же: `${UI.modal}.post-modal`. */
  modal: '.ui-modal',
  /** Слой окна во весь экран: прокрутка, отступы под вырезы. */
  modalWrap: '.ui-modal-wrap',
  /** Видимая панель окна. */
  modalContent: '.ui-modal__content',
  modalBody: '.ui-modal__body',
  /** Крестик окна. */
  modalClose: '.ui-modal__close',
  /** Окно подтверждения или сообщения (confirm / info / success / error). */
  confirm: '.ui-confirm',
  /** Ряд кнопок окна подтверждения. */
  confirmButtons: '.ui-confirm__buttons',
  /** Кнопка опасного действия (красная). */
  dangerButton: '.bastyon-button-danger',
  /** Основная кнопка (акцентная). */
  primaryButton: '.bastyon-button-primary',

  /** Элемент, открывающий выпадающее меню. */
  dropdownTrigger: '.ui-dropdown-trigger',
  /** Пункт выпадающего меню. */
  menuItem: '.ui-menu__item',
  /** Подпись пункта меню. */
  menuItemLabel: '.ui-menu__label',
  /** Иконка пункта меню. */
  menuItemIcon: '.ui-menu__icon',

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
  drawer: '.ui-drawer',
} as const
