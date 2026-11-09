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

  it('обновление из папки, куда без прав не записать, предлагает перенос, права или отмену', () => {
    const onInit = template.slice(
      template.indexOf('Function .onInit'),
      template.indexOf('FunctionEnd', template.indexOf('Function .onInit'))
    )
    expect(onInit).toMatch(/\$UpdateMode = 1\s+Call BastyonUpdateReadOnly/)
    const fn = template.slice(template.indexOf('Function BastyonUpdateReadOnly'))
    expect(fn).toMatch(
      /MB_YESNOCANCEL[^\n]*"\$\(bastyonUpdateNoWrite\)"[^\n]*IDYES bastyon_move IDNO bastyon_elevate/
    )
    // «Да» — папка учётной записи, старая копия запоминается для ярлыков и удаления.
    expect(fn).toMatch(
      /bastyon_move:\s+StrCpy \$BastyonOldDir \$INSTDIR\s+StrCpy \$INSTDIR "\$LOCALAPPDATA\\\$\{PRODUCTNAME\}"/
    )
    // «Нет» — тот же установщик с правами и на ту же папку: /D последним.
    expect(fn).toContain('ExecShell "runas" "$EXEPATH" "$BastyonProbe /D=$INSTDIR"')
  })

  it('ручная установка не запускает старый деинсталлятор там, где он ничего не удалит', () => {
    expect(template).toMatch(
      /reinst_uninstall:\s+[\s\S]{0,600}Call BastyonCanWrite\s+\$\{IfThen\} \$BastyonResult = 0 \$\{\|\} Goto reinst_done/
    )
  })

  it('страница папки предупреждает о папке для администраторов и меняет и поле, и $INSTDIR', () => {
    expect(template).toMatch(
      /MUI_PAGE_CUSTOMFUNCTION_LEAVE BastyonLeaveDirectory[^\n]*\n!insertmacro MUI_PAGE_DIRECTORY/
    )
    const fn = template.slice(template.indexOf('Function BastyonLeaveDirectory'))
    expect(fn.slice(0, fn.indexOf('FunctionEnd'))).toMatch(
      /StrCpy \$INSTDIR "\$LOCALAPPDATA\\\$\{PRODUCTNAME\}"[\s\S]*GetDlgItem \$BastyonProbe \$BastyonProbe 1019\s+SendMessage \$BastyonProbe \$\{WM_SETTEXT\} 0 "STR:\$INSTDIR"/
    )
  })

  it('старая копия удаляется только своими файлами, папка — только пустой', () => {
    const fn = template.slice(
      template.indexOf('Function BastyonAfterMove'),
      template.indexOf('FunctionEnd', template.indexOf('Function BastyonAfterMove'))
    )
    expect(fn).not.toMatch(/RMDir \/r|rmdir \/s/i)
    expect(fn).toContain(
      '\'/c del /f /q "$BastyonOldDir\\${MAINBINARYNAME}.exe" "$BastyonOldDir\\${MAINBINARYNAME}.exe.old" "$BastyonOldDir\\uninstall.exe" & rmdir "$BastyonOldDir"\''
    )
    expect(template).toMatch(/Section Install[\s\S]*Call BastyonAfterMove[\s\S]*SectionEnd/)
  })

  it('свои строки — на каждом языке установщика', () => {
    const strings = [
      'bastyonMsiNotRemoved',
      'bastyonUpdateNoWrite',
      'bastyonDirNoWrite',
      'bastyonDirAdminOnly',
      'bastyonOldCopy',
    ]
    for (const name of strings) {
      for (const language of bundle.windows.nsis.languages as string[]) {
        expect(template).toContain(`LangString ${name} \${LANG_${language.toUpperCase()}}`)
      }
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
