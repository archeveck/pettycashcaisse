import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      odooRequest: (url: string, body: any) => Promise<any>
    }
  }
}
