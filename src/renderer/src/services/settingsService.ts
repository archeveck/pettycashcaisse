import { supabase } from './supabase'

// App Settings
export interface AppSettings {
  max_outflow_limit: number
  alert_threshold: number
}

export const getAppSettings = async (): Promise<AppSettings> => {
  const { data, error } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', ['max_outflow_limit', 'alert_threshold'])

  if (error) throw error

  const settings: Partial<AppSettings> = {}
  data?.forEach((item): void => {
    settings[item.key as keyof AppSettings] = Number(item.value)
  })

  return settings as AppSettings
}

export const updateAppSetting = async (key: string, value: number | string): Promise<void> => {
  const { error } = await supabase.from('app_settings').upsert({ key, value: value.toString() })

  if (error) throw error
}

// Odoo Configuration
export interface OdooSettings {
  url: string
  db: string
  username: string
  password?: string
}

export const getOdooConfig = async (): Promise<OdooSettings> => {
  const { data, error } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', ['odoo_url', 'odoo_db', 'odoo_username', 'odoo_password'])

  if (error) throw error

  const config: OdooSettings = {
    url: '',
    db: '',
    username: '',
    password: ''
  }

  data?.forEach((item) => {
    if (item.key === 'odoo_url') config.url = item.value
    if (item.key === 'odoo_db') config.db = item.value
    if (item.key === 'odoo_username') config.username = item.value
    if (item.key === 'odoo_password') config.password = item.value
  })

  return config as OdooSettings
}

// Projects
export interface Project {
  id: string
  name: string
  code: string
  description?: string
  active: boolean
  created_at: string
}

export const getProjects = async (): Promise<Project[]> => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('name', { ascending: true })

  if (error) throw error
  return data as Project[]
}

export const createProject = async (
  project: Omit<Project, 'id' | 'created_at'>
): Promise<Project> => {
  const { data, error } = await supabase.from('projects').insert(project).select().single()

  if (error) throw error
  return data as Project
}

export const updateProject = async (
  id: string,
  updates: Partial<Omit<Project, 'id' | 'created_at'>>
): Promise<void> => {
  const { error } = await supabase.from('projects').update(updates).eq('id', id)

  if (error) throw error
}

export const deleteProject = async (id: string): Promise<void> => {
  const { error } = await supabase.from('projects').delete().eq('id', id)

  if (error) throw error
}

// Analytical Accounts
export interface AnalyticalAccount {
  id: string
  project_id: string
  name: string
  code: string
  created_at: string
  project?: {
    name: string
    code: string
  }
}

export const getAnalyticalAccounts = async (): Promise<AnalyticalAccount[]> => {
  const { data, error } = await supabase
    .from('analytical_accounts')
    .select(
      `
      *,
      project:projects (
        name,
        code
      )
    `
    )
    .order('code', { ascending: true })

  if (error) throw error
  return data as AnalyticalAccount[]
}

export const createAnalyticalAccount = async (
  account: Omit<AnalyticalAccount, 'id' | 'created_at' | 'project'>
): Promise<AnalyticalAccount> => {
  const { data, error } = await supabase
    .from('analytical_accounts')
    .insert(account)
    .select()
    .single()

  if (error) throw error
  return data as AnalyticalAccount
}

export const updateAnalyticalAccount = async (
  id: string,
  updates: Partial<Omit<AnalyticalAccount, 'id' | 'created_at' | 'project'>>
): Promise<void> => {
  const { error } = await supabase.from('analytical_accounts').update(updates).eq('id', id)

  if (error) throw error
}

export const deleteAnalyticalAccount = async (id: string): Promise<void> => {
  const { error } = await supabase.from('analytical_accounts').delete().eq('id', id)

  if (error) throw error
}

// Users
export interface UserProfile {
  id: string
  full_name: string | null
  role: 'admin' | 'controller' | 'cfo' | 'cashier' | 'requester'
  avatar_url: string | null
  updated_at: string | null
}

export const getUsers = async (): Promise<UserProfile[]> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('full_name', { ascending: true })

  if (error) throw error
  return data as UserProfile[]
}

export const updateUserRole = async (userId: string, role: UserProfile['role']): Promise<void> => {
  const { error } = await supabase
    .from('profiles')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', userId)

  if (error) throw error
}

// Suppliers
export interface Supplier {
  id: string
  name: string
  odoo_id?: number
  active: boolean
  created_at: string
}

export const getSuppliers = async (): Promise<Supplier[]> => {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('active', true)
    .order('name', { ascending: true })

  if (error) throw error
  return data as Supplier[]
}

export const updateSupplier = async (
  id: string,
  updates: Partial<Omit<Supplier, 'id' | 'created_at'>>
): Promise<void> => {
  const { error } = await supabase.from('suppliers').update(updates).eq('id', id)

  if (error) throw error
}

export const deleteSupplier = async (id: string): Promise<void> => {
  const { error } = await supabase.from('suppliers').delete().eq('id', id)

  if (error) throw error
}
