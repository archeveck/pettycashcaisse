import { supabase } from './supabase'

export interface OdooConfig {
  url: string
  db: string
  username: string
  password?: string
}

export interface OdooProject {
  id: number
  name: string
  analytic_account_id?: [number, string] | false
}

export interface OdooAnalyticalAccount {
  id: number
  name: string
  code: string
}

async function odooCall<T>(
  config: OdooConfig,
  service: string,
  method: string,
  args: unknown[]
): Promise<T> {
  const result = await window.api.odooRequest(`${config.url}/jsonrpc`, {
    jsonrpc: '2.0',
    method: 'call',
    params: {
      service,
      method,
      args
    }
  })

  if (result.error) {
    throw new Error(result.error.data?.message || result.error.message)
  }
  return result.result as T
}

export const authenticateOdoo = async (config: OdooConfig): Promise<number> => {
  return odooCall<number>(config, 'common', 'authenticate', [
    config.db,
    config.username,
    config.password,
    {}
  ])
}

export const fetchOdooProjects = async (config: OdooConfig, uid: number): Promise<OdooProject[]> => {
  return odooCall<OdooProject[]>(config, 'object', 'execute_kw', [
    config.db,
    uid,
    config.password,
    'project.project',
    'search_read',
    [[['active', '=', true], ['company_id', '=', 1]]],
    { fields: ['id', 'name', 'analytic_account_id'] }
  ])
}

export const syncOdooData = async (
  config: OdooConfig
): Promise<{ projects: number; accounts: number }> => {
  const uid = await authenticateOdoo(config)
  if (!uid) throw new Error('Échec de l’authentification Odoo')

  // 1. Récupérer les projets de la société filtrée (ex: HYD, PAD2, IRAH...)
  const odooProjects = await fetchOdooProjects(config, uid)
  
  // Extraire les suffixes probables des projets (ex: de "HYDRO 1000", on aura peut-être besoin de "HYD")
  // Note: Dans les logs, on voit "SIEGE", "AGENCE", "HYDRO 1000" et des suffixes "_HYD", "_PAD2"
  // On va créer un mapping manuel ou basé sur les patterns observés
  const suffixToProjectMap = new Map<string, number>()
  for (const p of odooProjects) {
    const name = p.name.toUpperCase()
    if (name.includes('HYDRO 1000')) suffixToProjectMap.set('HYD', p.id)
    if (name.includes('SIEGE')) suffixToProjectMap.set('SIEGE', p.id) // Fallback for name only
    if (name.includes('AGENCE')) suffixToProjectMap.set('AGENCE', p.id)
    // On peut aussi essayer d'extraire les 3 premières lettres ou des codes connus
    if (name === 'SIEGE') suffixToProjectMap.set('SIG', p.id)
    if (name === 'HYDRO 1000') suffixToProjectMap.set('HYDRO', p.id)
  }

  // 2. Récupérer TOUS les comptes analytiques actifs
  const odooAccounts = await odooCall<OdooAnalyticalAccount[]>(config, 'object', 'execute_kw', [
    config.db,
    uid,
    config.password,
    'account.analytic.account',
    'search_read',
    [[['active', '=', true]]],
    { fields: ['id', 'name', 'code'] }
  ])

  let projectsSynced = 0
  let accountsSynced = 0

  // 3. Synchroniser les projets dans Supabase
  for (const op of odooProjects) {
    const { data: existing } = await supabase
      .from('projects')
      .select('id')
      .eq('odoo_id', op.id)
      .maybeSingle()

    const projectData = {
      name: op.name,
      code: `ODOO_${op.id}`,
      odoo_id: op.id,
      active: true
    }

    if (existing) {
      await supabase.from('projects').update(projectData).eq('id', existing.id)
    } else {
      await supabase.from('projects').insert(projectData)
    }
    projectsSynced++
  }

  // 4. Synchroniser les comptes analytiques
  const { data: localProjects } = await supabase.from('projects').select('id, odoo_id, name')
  const projectOdooMap = new Map((localProjects || []).map((p) => [p.odoo_id, p.id]))
  const projectNameMap = new Map((localProjects || []).map((p) => [p.name.toLowerCase().trim(), p.id]))

  for (const oa of odooAccounts) {
    const accountName = oa.name.trim()
    const accountNameNorm = accountName.toLowerCase()

    // Déterminer le projet Odoo associé
    let linkedProjectId: number | undefined

    // Stratégie 1: Lien technique
    const opTechnical = odooProjects.find(p => p.analytic_account_id && p.analytic_account_id[0] === oa.id)
    if (opTechnical) linkedProjectId = opTechnical.id

    // Stratégie 2: Suffixe (ex: "Account Name_HYD")
    if (!linkedProjectId && accountName.includes('_')) {
      const parts = accountName.split('_')
      const suffix = parts[parts.length - 1].toUpperCase()
      linkedProjectId = suffixToProjectMap.get(suffix)
    }

    // Stratégie 3: Suffixe TIK, GAB, IRAH, BDS, SIG, PAD, AG, ATM, SG, SAN, MED, GPM...
    if (!linkedProjectId) {
      // On teste si l'un de nos noms de projet est contenu ou contient le nom du compte
      const opByMatch = odooProjects.find(p => {
        const pNameNorm = p.name.toLowerCase().trim()
        return pNameNorm === accountNameNorm || 
               accountNameNorm.includes(pNameNorm) || 
               pNameNorm.includes(accountNameNorm)
      })
      if (opByMatch) linkedProjectId = opByMatch.id
    }

    if (!linkedProjectId) continue

    const localProjectId = projectOdooMap.get(linkedProjectId)
    if (!localProjectId) continue

    const { data: existingAcc } = await supabase
      .from('analytical_accounts')
      .select('id')
      .eq('odoo_id', oa.id)
      .eq('project_id', localProjectId)
      .maybeSingle()

    const accountData = {
      name: oa.name,
      code: oa.code || `ODOO_${oa.id}`,
      project_id: localProjectId,
      odoo_id: oa.id
    }

    if (existingAcc) {
      await supabase.from('analytical_accounts').update(accountData).eq('id', existingAcc.id)
    } else {
      await supabase.from('analytical_accounts').insert(accountData)
    }
    accountsSynced++
  }

  return { projects: projectsSynced, accounts: accountsSynced }
}
