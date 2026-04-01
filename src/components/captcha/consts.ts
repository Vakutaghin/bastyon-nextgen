// Константы компонента капчи

/** Путь к CSS файлу HexCaptcha */
export const CAPTCHA_CSS_PATH = '/node_modules/hex-captcha/css/captcha.css'

/** Регулярное выражение для валидации кода капчи (мин. 4 символа) */
export const CAPTCHA_VALIDATION_REGEX = /^[a-zA-Z0-9]{4,}$/

/** Длительность анимации HexCaptcha (мс) */
export const CAPTCHA_ANIMATION_DURATION = 250

/** Задержка перед операциями с капчей (мс) */
export const CAPTCHA_ACTION_DELAY = 300

/** Задержка скролла на мобильных (мс) */
export const MOBILE_SCROLL_DELAY = 200

/** Брейкпоинт мобильного устройства (px) */
export const MOBILE_BREAKPOINT = 768

/** Маппинг причины → отображаемый текст */
export const REASON_TITLES: Record<string, string> = {
  registration: 'Регистрация аккаунта',
  balance: 'Пополнение баланса',
}

/** Маппинг типа ошибки → текст сообщения */
export const ERROR_MESSAGES: Record<string, string> = {
  captchashots: 'Превышено количество попыток. Попробуйте позже.',
  captchanotequal_angles: 'Углы не совпадают. Попробуйте ещё раз.',
}
