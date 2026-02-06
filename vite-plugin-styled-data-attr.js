/**
 * Vite плагин для автоматического добавления data-styled-name атрибутов
 * к styled компонентам в template для читаемости в dev-режиме
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'

export function styledDataAttr() {
  return {
    name: 'styled-data-attr',
    enforce: 'pre',
    transform(code, id) {
      // Обрабатываем только .vue файлы
      if (!id.endsWith('.vue')) {
        return null
      }

      // Находим секцию <script> для получения имен styled компонентов
      const scriptMatch = code.match(/<script[^>]*>([\s\S]*?)<\/script>/)
      if (!scriptMatch) {
        return null
      }

      const scriptContent = scriptMatch[1]

      // Собираем имена всех styled компонентов из script
      const styledComponents = new Set()

      // 1. Ищем объявления const SC_XXX = styled...
      const styledPattern = /const\s+(SC_[A-Z][a-zA-Z0-9_]*)\s*=\s*styled/g
      let match

      while ((match = styledPattern.exec(scriptContent)) !== null) {
        styledComponents.add(match[1])
      }

      // 2. Ищем импорты из styled файлов
      // Паттерн для: import { SC_XXX, SC_YYY } from './styled'
      // или: import { SC_XXX, SC_YYY } from './styled.ts'
      // Поддерживает многострочные импорты
      const importPattern = /import\s*\{([^}]+)\}\s*from\s*['"]\.\/styled(?:\.tsx?)?['"]/gs

      while ((match = importPattern.exec(scriptContent)) !== null) {
        const imports = match[1]
        // Извлекаем все имена компонентов, начинающиеся с SC_
        // Очищаем от пробелов и переносов строк
        const componentNames = imports.match(/\b(SC_[A-Z][a-zA-Z0-9_]*)\b/g)
        if (componentNames) {
          componentNames.forEach(name => styledComponents.add(name.trim()))
        }
      }

      // 3. Ищем импорты из внешних .ts файлов (например, './video-player.ts')
      // Паттерн для: import { videoPlayerOptions } from './video-player.ts'
      // или: import { postCardOptions } from './post-card.ts'
      // Поддерживает относительные пути: './file.ts', '../file.ts'
      const externalTsImportPattern = /import\s*\{[^}]+\}\s*from\s*['"](\.\/[^'"]+\.ts)['"]/g
      const processedFiles = new Set()

      while ((match = externalTsImportPattern.exec(scriptContent)) !== null) {
        const importPath = match[1]
        let filePath
        
        try {
          // Разрешаем путь относительно текущего файла
          filePath = resolve(dirname(id), importPath)
          
          // Нормализуем путь (убираем .. и .)
          filePath = resolve(filePath)
        } catch (err) {
          // Если не удалось разрешить путь, пропускаем
          continue
        }
        
        // Избегаем повторной обработки одного и того же файла
        if (processedFiles.has(filePath)) {
          continue
        }
        processedFiles.add(filePath)

        try {
          // Читаем содержимое .ts файла
          const tsFileContent = readFileSync(filePath, 'utf-8')
          
          // Ищем импорты styled компонентов в этом файле
          // Поддерживаем разные варианты путей: './styled', './styled.ts', '../styled'
          const styledImportPattern = /import\s*\{([^}]+)\}\s*from\s*['"](\.\/|\.\.\/)+styled(?:\.tsx?)?['"]/gs
          let tsMatch
          
          while ((tsMatch = styledImportPattern.exec(tsFileContent)) !== null) {
            const imports = tsMatch[1]
            const componentNames = imports.match(/\b(SC_[A-Z][a-zA-Z0-9_]*)\b/g)
            if (componentNames) {
              componentNames.forEach(name => styledComponents.add(name.trim()))
            }
          }
        } catch (err) {
          // Игнорируем ошибки чтения файла (файл может не существовать или быть недоступен)
          // В dev-режиме можно логировать, но не критично
        }
      }

      if (styledComponents.size === 0) {
        return null
      }

      // Находим секцию <template>
      const templateMatch = code.match(/<template>([\s\S]*?)<\/template>/)
      if (!templateMatch) {
        return null
      }

      let templateContent = templateMatch[1]
      const templateStart = templateMatch.index + '<template>'.length
      let hasChanges = false

      // Добавляем data-styled-name к каждому styled компоненту в template
      styledComponents.forEach(compName => {
        // Паттерн для поиска открывающих тегов компонента
        // Ищем <SC_XXX>, <SC_XXX />, <SC_XXX с атрибутами>, <SC_XXX с атрибутами />
        const tagPattern = new RegExp(`<${compName}(\\s+[^>]*)?(\\s*\\/)?>`, 'g')

        templateContent = templateContent.replace(tagPattern, (match) => {
          // Проверяем, нет ли уже data-styled-name
          if (match.includes('data-styled-name')) {
            return match
          }

          hasChanges = true

          // Проверяем, самозакрывающийся ли это тег
          const trimmedMatch = match.trim()
          const isSelfClosing = trimmedMatch.endsWith('/>')

          // Если тег закрывается сразу (<SC_XXX> или <SC_XXX />), добавляем атрибут
          if (trimmedMatch === `<${compName}>` || trimmedMatch === `<${compName}/>`) {
            return isSelfClosing
              ? `<${compName} data-styled-name="${compName}" />`
              : `<${compName} data-styled-name="${compName}">`
          }

          // Если есть атрибуты, извлекаем их и добавляем data-styled-name в начало
          // <SC_XXX attr="value"> -> <SC_XXX data-styled-name="SC_XXX" attr="value">
          // <SC_XXX attr="value" /> -> <SC_XXX data-styled-name="SC_XXX" attr="value" />
          const closingPart = isSelfClosing ? ' />' : '>'
          // Извлекаем все между <SC_XXX и закрывающим символом
          const startTag = `<${compName}`
          const startIndex = match.indexOf(startTag) + startTag.length
          const endIndex = isSelfClosing ? match.lastIndexOf('/>') : match.lastIndexOf('>')
          const attrs = match.slice(startIndex, endIndex).trim()

          return `<${compName} data-styled-name="${compName}"${attrs ? ' ' + attrs : ''}${closingPart}`
        })
      })

      if (hasChanges) {
        const newCode = code.slice(0, templateStart) + templateContent + code.slice(templateStart + templateMatch[1].length)
        return {
          code: newCode,
          map: null
        }
      }

      return null
    }
  }
}
