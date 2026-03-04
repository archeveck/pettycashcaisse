import { useState, useEffect } from 'react'
import { Download, X, RefreshCw } from 'lucide-react'

interface UpdateInfo {
  version: string
  releaseNotes?: string
}

interface DownloadProgress {
  percent: number
  transferred: number
  total: number
}

export function UpdateNotification(): JSX.Element | null {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null)
  const [updateReady, setUpdateReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Écouter les événements de mise à jour
    const removeUpdateAvailable = window.electron.ipcRenderer.on(
      'update-available',
      (_event, info: UpdateInfo) => {
        setUpdateAvailable(true)
        setUpdateInfo(info)
        setDismissed(false)
      }
    )

    const removeDownloadProgress = window.electron.ipcRenderer.on(
      'update-download-progress',
      (_event, progress: DownloadProgress) => {
        setDownloadProgress(progress)
      }
    )

    const removeUpdateDownloaded = window.electron.ipcRenderer.on('update-downloaded', () => {
      setDownloading(false)
      setUpdateReady(true)
    })

    const removeUpdateError = window.electron.ipcRenderer.on(
      'update-error',
      (_event, errorMessage: string) => {
        setError(errorMessage)
        setDownloading(false)
      }
    )

    return () => {
      removeUpdateAvailable()
      removeDownloadProgress()
      removeUpdateDownloaded()
      removeUpdateError()
    }
  }, [])

  const handleDownload = async (): Promise<void> => {
    setDownloading(true)
    setError(null)
    await window.electron.ipcRenderer.invoke('download-update')
  }

  const handleInstall = async (): Promise<void> => {
    await window.electron.ipcRenderer.invoke('quit-and-install')
  }

  const handleDismiss = (): void => {
    setDismissed(true)
  }

  // Ne rien afficher si pas de mise à jour ou si l'utilisateur a fermé la notification
  if (!updateAvailable || dismissed) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 rounded-lg border border-gray-200 bg-white shadow-lg">
      <div className="p-4">
        {/* En-tête */}
        <div className="mb-3 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Download className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">
              {updateReady ? 'Mise à jour prête' : 'Mise à jour disponible'}
            </h3>
          </div>
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Contenu */}
        <div className="mb-4 text-sm text-gray-600">
          {updateReady ? (
            <p>La mise à jour est prête à être installée. L'application va redémarrer.</p>
          ) : (
            <>
              <p className="mb-1">
                Version <span className="font-medium">{updateInfo?.version}</span> disponible
              </p>
              {updateInfo?.releaseNotes && (
                <p className="mt-2 text-xs text-gray-500">{updateInfo.releaseNotes}</p>
              )}
            </>
          )}
        </div>

        {/* Barre de progression */}
        {downloading && downloadProgress && (
          <div className="mb-4">
            <div className="mb-1 flex justify-between text-xs text-gray-600">
              <span>Téléchargement...</span>
              <span>{Math.round(downloadProgress.percent)}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${downloadProgress.percent}%` }}
              />
            </div>
          </div>
        )}

        {/* Erreur */}
        {error && <div className="mb-4 rounded bg-red-50 p-2 text-sm text-red-600">{error}</div>}

        {/* Actions */}
        <div className="flex gap-2">
          {updateReady ? (
            <>
              <button
                onClick={handleInstall}
                className="flex flex-1 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <RefreshCw className="h-4 w-4" />
                Installer et redémarrer
              </button>
              <button
                onClick={handleDismiss}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Plus tard
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="flex flex-1 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {downloading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Téléchargement...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Télécharger
                  </>
                )}
              </button>
              <button
                onClick={handleDismiss}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Ignorer
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
