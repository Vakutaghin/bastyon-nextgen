// Self-installing патч: подменяет шейдер/UBO-системы pixi на полифилы без
// `new Function()`. Нужен, потому что CSP приложения запрещает unsafe-eval, и
// иначе `app.init()` падает с «Current environment does not allow unsafe-eval».
// Отдельным модулем — чтобы грузиться вместе с PixiJS, по первому эффекту.
import 'pixi.js/unsafe-eval'
