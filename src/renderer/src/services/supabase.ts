import { createClient } from '@supabase/supabase-js'

// These should ideally be in .env, but for now we'll use placeholders or expect them to be set.
// The user will need to provide these.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Export configuration status to handle UI gracefully
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

// Create client only if configuration is valid to avoid crashing at startup
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
)
