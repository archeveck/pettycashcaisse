import { autoUpdater } from 'electron-updater'
import { app, BrowserWindow, ipcMain } from 'electron'
import log from 'electron-log'

// Configure le logger pour les mises à jour
autoUpdater.logger = log
log.transports.file.level = 'info'

export class UpdateService {
  private mainWindow: BrowserWindow | null = null
  private updateCheckInterval: NodeJS.Timeout | null = null

  constructor() {
    // Désactiver les mises à jour en mode développement
    if (process.env.NODE_ENV === 'development') {
      autoUpdater.updateConfigPath = null
      return
    }

    this.setupAutoUpdater()
  }

  /**
   * Configure les événements de l'auto-updater
   */
  private setupAutoUpdater(): void {
    // Vérifier les mises à jour au démarrage (après 10 secondes)
    setTimeout(() => {
      this.checkForUpdates()
    }, 10000)

    // Vérifier périodiquement (toutes les 4 heures)
    this.updateCheckInterval = setInterval(
      () => {
        this.checkForUpdates()
      },
      4 * 60 * 60 * 1000
    )

    // Événement : Mise à jour disponible
    autoUpdater.on('update-available', (info) => {
      log.info('Mise à jour disponible:', info)
      this.sendToRenderer('update-available', info)
    })

    // Événement : Pas de mise à jour disponible
    autoUpdater.on('update-not-available', (info) => {
      log.info('Pas de mise à jour disponible:', info)
    })

    // Événement : Erreur lors de la vérification
    autoUpdater.on('error', (err) => {
      log.error('Erreur de mise à jour:', err)
      this.sendToRenderer('update-error', err.message)
    })

    // Événement : Progression du téléchargement
    autoUpdater.on('download-progress', (progressObj) => {
      log.info('Progression du téléchargement:', progressObj.percent)
      this.sendToRenderer('update-download-progress', {
        percent: progressObj.percent,
        transferred: progressObj.transferred,
        total: progressObj.total
      })
    })

    // Événement : Téléchargement terminé
    autoUpdater.on('update-downloaded', (info) => {
      log.info('Mise à jour téléchargée:', info)
      this.sendToRenderer('update-downloaded', info)
    })
  }

  /**
   * Définit la fenêtre principale pour envoyer des événements
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window
  }

  /**
   * Vérifie les mises à jour disponibles
   */
  async checkForUpdates(): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
      log.info('Mode développement - vérification des mises à jour désactivée')
      return
    }

    try {
      log.info('Vérification des mises à jour...')
      await autoUpdater.checkForUpdates()
    } catch (error) {
      log.error('Erreur lors de la vérification des mises à jour:', error)
    }
  }

  /**
   * Télécharge la mise à jour
   */
  async downloadUpdate(): Promise<void> {
    try {
      log.info('Téléchargement de la mise à jour...')
      await autoUpdater.downloadUpdate()
    } catch (error) {
      log.error('Erreur lors du téléchargement:', error)
      this.sendToRenderer('update-error', 'Erreur lors du téléchargement')
    }
  }

  /**
   * Installe la mise à jour et redémarre l'application
   */
  quitAndInstall(): void {
    log.info('Installation de la mise à jour et redémarrage...')
    autoUpdater.quitAndInstall(false, true)
  }

  /**
   * Envoie un événement au renderer process
   */
  private sendToRenderer(channel: string, data?: unknown): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data)
    }
  }

  /**
   * Configure les gestionnaires IPC
   */
  setupIpcHandlers(): void {
    // Vérifier manuellement les mises à jour
    ipcMain.handle('check-for-updates', async () => {
      await this.checkForUpdates()
    })

    // Télécharger la mise à jour
    ipcMain.handle('download-update', async () => {
      await this.downloadUpdate()
    })

    // Installer et redémarrer
    ipcMain.handle('quit-and-install', () => {
      this.quitAndInstall()
    })

    // Obtenir la version actuelle
    ipcMain.handle('get-app-version', () => {
      return app.getVersion()
    })
  }

  /**
   * Nettoie les ressources
   */
  cleanup(): void {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval)
      this.updateCheckInterval = null
    }
  }
}

// Instance singleton
export const updateService = new UpdateService()
