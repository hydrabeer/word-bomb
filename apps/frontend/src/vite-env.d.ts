/// <reference types="vite/client" />

// This is not actually unused; socket.ts is using it to infer type information about
// VITE_BACKEND_URL
interface ImportMetaEnv {
  readonly VITE_BACKEND_URL: string;
}
