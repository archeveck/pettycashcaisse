import { createClient } from '@supabase/supabase-js'

// These should ideally be in .env, but for now we'll use placeholders or expect them to be set.
// The user will need to provide these.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
