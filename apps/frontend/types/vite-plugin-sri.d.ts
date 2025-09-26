declare module 'vite-plugin-sri' {
  export interface SriOptions {
    algorithms?: ('sha256' | 'sha384' | 'sha512')[];
  }

  const _default: (options?: SriOptions) => import('vite').Plugin;
  export default _default;
}
