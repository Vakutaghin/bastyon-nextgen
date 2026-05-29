// Type shim for SFC imports — позволяет tsc и IDE резолвить `import Foo from './foo.vue'`.
// Без этого .vue-импорты из *.ts-файлов считались `any`/нерезолвимыми.
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const component: DefineComponent<Record<string, never>, Record<string, never>, any>
  export default component
}
