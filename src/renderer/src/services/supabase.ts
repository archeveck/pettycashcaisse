import { createClient } from '@supabase/supabase-js'

const SERVER_CONFIG_KEY = 'supabase_server_config'

export interface ServerConfig {
  url: string
  anonKey: string
}

const envConfig: ServerConfig = {
  url: import.meta.env.VITE_SUPABASE_URL || '',
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || ''
}

// Configuration saisie par l'administrateur (prioritaire sur le fichier .env)
function readOverride(): ServerConfig | null {
  try {
    const raw = localStorage.getItem(SERVER_CONFIG_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ServerConfig>
    return parsed.url && parsed.anonKey ? { url: parsed.url, anonKey: parsed.anonKey } : null
  } catch {
    return null
  }
}

export function getServerConfig(): ServerConfig {
  return readOverride() ?? envConfig
}

export function isServerConfigOverridden(): boolean {
  return readOverride() !== null
}

// Le client est créé au démarrage : l'application doit être rechargée après modification.
export function saveServerConfig(config: ServerConfig): void {
  localStorage.setItem(SERVER_CONFIG_KEY, JSON.stringify(config))
}

export function resetServerConfig(): void {
  localStorage.removeItem(SERVER_CONFIG_KEY)
}

const { url, anonKey } = getServerConfig()

// Export configuration status to handle UI gracefully
export const isSupabaseConfigured = Boolean(url && anonKey)

// Create client with placeholders if not configured to avoid crashing at startup
export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder'
)
