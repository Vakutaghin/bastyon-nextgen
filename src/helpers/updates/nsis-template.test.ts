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

  it('MSI удаляется тихо, а не удалившийся не оставляет вторую копию', () => {
    expect(template).toContain(
      'ExecWait \'"$SYSDIR\\msiexec.exe" /x $WixProductCode /passive /norestart\' $0'
    )
    expect(template).not.toContain('ReadRegStr $R1 HKLM "$R6" "UninstallString"')
    expect(template).toMatch(/\$\{AndIf\} \$UpdateMode = 1[\s\S]{0,400}Quit/)
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
