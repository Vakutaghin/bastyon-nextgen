/**
 * Установщик Windows — свой шаблон NSIS (src-tauri/windows/installer.nsi):
 * шаблон tauri-cli с правками для перехода с MSI. Шаблон рендерит CLI своими
 * данными, и чужой версии шаблон может не подойти. Обновили CLI — тест
 * напоминает перенести правки на его шаблон.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../../..')
const template = readFileSync(resolve(ROOT, 'src-tauri/windows/installer.nsi'), 'utf8')
const cliVersion: string = JSON.parse(
  readFileSync(resolve(ROOT, 'node_modules/@tauri-apps/cli/package.json'), 'utf8')
).version
const bundle = JSON.parse(readFileSync(resolve(ROOT, 'src-tauri/tauri.conf.json'), 'utf8')).bundle

describe('шаблон установщика Windows', () => {
  it('снят с установленной версии tauri-cli', () => {
    expect(template.split('\n')[1]).toBe(`; tauri-cli ${cliVersion}`)
  })

  it('MSI удаляется тихо, а не удалившийся — вопросом, а не молчаливым откатом', () => {
    expect(template).toContain(
      'ExecWait \'"$SYSDIR\\msiexec.exe" /x $WixProductCode /passive /norestart\' $0'
    )
    expect(template).not.toContain('ReadRegStr $R1 HKLM "$R6" "UninstallString"')
    // «Повторить» — снова msiexec, «Пропустить» — ставим рядом, «Прервать» — прежняя версия.
    expect(template).toMatch(
      /MB_ABORTRETRYIGNORE[^\n]*"\$\(bastyonMsiNotRemoved\)"[^\n]*IDRETRY reinst_uninstall IDIGNORE reinst_done\n[\s\S]{0,400}Quit/
    )
  })

  it('обновление поставленного для пользователя не трогает оставленный MSI', () => {
    expect(template).toMatch(
      /Function PageReinstall[\s\S]{0,400}\$UpdateMode = 1[\s\S]{0,200}Goto wix_loop_done[\s\S]*wix_loop:/
    )
  })

  it('ждёт, пока закрывающееся приложение отпустит exe, а не падает на записи', () => {
    const install = template.slice(template.indexOf('Section Install'))
    const wait = install.indexOf('FileOpen $R8 "$INSTDIR\\${MAINBINARYNAME}.exe" a')
    expect(wait).toBeGreaterThan(install.indexOf('CheckIfAppIsRunning'))
    expect(wait).toBeLessThan(install.indexOf('File "${MAINBINARYSRCPATH}"'))
    expect(install).toContain(
      'Rename "$INSTDIR\\${MAINBINARYNAME}.exe" "$INSTDIR\\${MAINBINARYNAME}.exe.old"'
    )
    expect(template).toContain('Delete "$INSTDIR\\${MAINBINARYNAME}.exe.old" ; BASTYON')
  })

  it('свои строки — на каждом языке установщика', () => {
    for (const language of bundle.windows.nsis.languages as string[]) {
      expect(template).toContain(
        `LangString bastyonMsiNotRemoved \${LANG_${language.toUpperCase()}}`
      )
    }
  })

  it('сборка берёт его и ставит для текущего пользователя, без MSI', () => {
    expect(bundle.targets).toContain('nsis')
    expect(bundle.targets).not.toContain('msi')
    expect(bundle.windows.nsis).toMatchObject({
      installMode: 'currentUser',
      template: 'windows/installer.nsi',
    })
  })
})
