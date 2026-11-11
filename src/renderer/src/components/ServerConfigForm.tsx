import { useState } from 'react'
import { Save } from 'lucide-react'
import {
  getServerConfig,
  saveServerConfig,
  resetServerConfig,
  isServerConfigOverridden
} from '../services/supabase'

const inputClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm'

export default function ServerConfigForm(): React.ReactElement {
  const [serverUrl, setServerUrl] = useState(() => getServerConfig().url)
  const [serverKey, setServerKey] = useState(() => getServerConfig().anonKey)
  const overridden = isServerConfigOverridden()

  const handleSave = (): void => {
    const url = serverUrl.trim().replace(/\/+$/, '')
    const anonKey = serverKey.trim()
    try {
      const { protocol } = new URL(url)
      if (protocol !== 'https:' && protocol !== 'http:') throw new Error()
    } catch {
      alert("L'adresse du serveur est invalide (ex: https://xxxx.supabase.co)")
      return
    }
    if (!anonKey) {
      alert('La clé publique (anon key) du serveur est obligatoire')
      return
    }
    if (
      !confirm(
        "Changer le serveur de base de données ? L'application va se recharger et vous devrez vous reconnecter."
      )
    )
      return
    saveServerConfig({ url, anonKey })
    window.location.reload()
  }

  const handleReset = (): void => {
    if (!confirm("Revenir au serveur par défaut de l'application ?")) return
    resetServerConfig()
    window.location.reload()
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Adresse du serveur Supabase utilisé par cette installation de l&apos;application.
        {overridden && ' (adresse personnalisée active)'}
      </p>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="server-url">
          Adresse du serveur (URL)
        </label>
        <input
          id="server-url"
          type="url"
          value={serverUrl}
          onChange={(e) => setServerUrl(e.target.value)}
          placeholder="https://xxxx.supabase.co"
          className={inputClass}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="server-key">
          Clé publique (anon key)
        </label>
        <input
          id="server-key"
          type="password"
          value={serverKey}
          onChange={(e) => setServerKey(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="flex gap-4">
        <button
          type="button"
          onClick={handleSave}
          className="flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          <Save className="w-4 h-4 mr-2" />
          Changer de serveur
        </button>
        {overridden && (
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 border border-input rounded-md hover:bg-muted transition-colors"
          >
            Rétablir le serveur par défaut
          </button>
        )}
      </div>
    </div>
  )
}
