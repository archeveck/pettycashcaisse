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
}

export interface OdooAccountAccount {
  id: number
  name: string
  code: string
}

export interface OdooAnalyticalAccount {
  id: number
  name: string
  code: string
  plan_id: [number, string]
}

export interface OdooSupplier {
  id: number
  name: string
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

export const fetchOdooSuppliers = async (
  config: OdooConfig,
  uid: number
): Promise<OdooSupplier[]> => {
  return odooCall<OdooSupplier[]>(config, 'object', 'execute_kw', [
    config.db,
    uid,
    config.password,
    'res.partner',
    'search_read',
    [
      [
        ['active', '=', true],
        ['supplier_rank', '>', 0],
        ['company_id', '=', 1]
      ]
    ],
    { fields: ['id', 'name'] }
  ])
}

export const fetchOdooAccountAccounts = async (
  config: OdooConfig,
  uid: number
): Promise<OdooAccountAccount[]> => {
  return odooCall<OdooAccountAccount[]>(config, 'object', 'execute_kw', [
    config.db,
    uid,
    config.password,
    'account.account',
    'search_read',
    [[['deprecated', '=', false], ['company_id', '=', 1]]],
    { fields: ['id', 'name', 'code'] }
  ])
}

export const syncOdooData = async (
  config: OdooConfig
): Promise<{ projects: number; accounts: number; suppliers: number; accountingAccounts: number }> => {
  const uid = await authenticateOdoo(config)
  if (!uid) throw new Error('Échec de l’authentification Odoo')

  // 1. Récupérer les COMPTES analytiques de la société (company_id = 1)
  const odooAccounts = await odooCall<OdooAnalyticalAccount[]>(config, 'object', 'execute_kw', [
    config.db,
    uid,
    config.password,
    'account.analytic.account',
    'search_read',
    [
      [
        ['active', '=', true],
        ['company_id', '=', 1]
      ]
    ],
    { fields: ['id', 'name', 'code', 'plan_id'] }
  ])
  console.log('Odoo Accounts (first 2):', odooAccounts.slice(0, 2))

  // 2. Extraire les IDs de plans uniques de ces comptes
  const planIds = [
    ...new Set(
      odooAccounts
        .map((a) => (a.plan_id ? a.plan_id[0] : null))
        .filter((id): id is number => id !== null)
    )
  ]

  // 3. Récupérer les PROJETS (plans analytiques) correspondants
  let odooProjects: OdooProject[] = []
  if (planIds.length > 0) {
    odooProjects = await odooCall<OdooProject[]>(config, 'object', 'execute_kw', [
      config.db,
      uid,
      config.password,
      'account.analytic.plan',
      'search_read',
      [[['id', 'in', planIds]]],
      { fields: ['id', 'name'] }
    ])
  }
  console.log('Odoo Plans/Projects (first 2):', odooProjects.slice(0, 2))

  // Extraire les sigles pour le matching de secours
  // Note: Dans les logs, on voit "SIEGE", "AGENCE", "HYDRO 1000" et des suffixes "_HYD", "_PAD2"
  // On va créer un mapping manuel ou basé sur les patterns observés
  const suffixToProjectMap = new Map<string, number>()
  for (const p of odooProjects) {
    const name = p.name.toUpperCase()

    // 1. Extraire les codes entre parenthèses ou crochets (ex: "PROJET X [TIK]")
    const match = name.match(/\[(.*?)\]|\((.*?)\)/)
    if (match) {
      const code = (match[1] || match[2]).trim()
      if (code && code.length >= 2) suffixToProjectMap.set(code, p.id)
    }

    // 2. Extraire la première partie si c'est un code court (ex: "HYD - Projet")
    const parts = name.split(/[\s-]+/)
    for (const part of parts) {
      if (
        part.length >= 2 &&
        part.length <= 6 &&
        !['AND', 'THE', 'FOR', 'DE', 'LA', 'LE'].includes(part)
      ) {
        suffixToProjectMap.set(part, p.id)
      }
    }

    // 3. Mappages manuels spécifiques connus
    if (name.includes('HYDRO 1000')) suffixToProjectMap.set('HYD', p.id)
    if (name.includes('SIEGE')) {
      suffixToProjectMap.set('SIEGE', p.id)
      suffixToProjectMap.set('SIG', p.id)
    }
    if (name.includes('AGENCE')) suffixToProjectMap.set('AGENCE', p.id)
  }

  console.log('Project Acronym Map:', Object.fromEntries(suffixToProjectMap))

  let projectsSynced = 0
  let accountsSynced = 0

  // 3. Synchroniser les projets dans Supabase
  for (const op of odooProjects) {
    const projectData = {
      name: op.name,
      code: `ODOO_${op.id}`,
      odoo_id: op.id,
      active: true
    }

    await supabase.from('projects').upsert(projectData, { onConflict: 'odoo_id' })
    projectsSynced++
  }

  // Désactiver les projets locaux qui ne sont plus dans Odoo (uniquement ceux qui ont un odoo_id)
  const odooProjectIds = odooProjects.map((p) => p.id)
  if (odooProjectIds.length > 0) {
    await supabase
      .from('projects')
      .update({ active: false })
      .not('odoo_id', 'is', null)
      .not('odoo_id', 'in', `(${odooProjectIds.join(',')})`)
  } else {
    await supabase.from('projects').update({ active: false }).not('odoo_id', 'is', null)
  }

  // 4. Synchroniser les comptes analytiques
  const { data: localProjects } = await supabase.from('projects').select('id, odoo_id, name')
  const projectOdooMap = new Map((localProjects || []).map((p) => [p.odoo_id, p.id]))

  for (const oa of odooAccounts) {
    const accountName = oa.name.trim()
    const accountNameNorm = accountName.toLowerCase()

    // Déterminer le projet Odoo associé
    let linkedProjectId: number | undefined

    // Stratégie 1: Lien par plan_id (Recommandé par l'utilisateur)
    if (oa.plan_id && oa.plan_id[0]) {
      linkedProjectId = oa.plan_id[0]
    }

    // Stratégie 2: Recherche de sigles/codes partout dans le nom (Fallback)
    if (!linkedProjectId) {
      const parts = accountName.split(/[_\s.-]/)
      for (const part of parts) {
        const seg = part.toUpperCase().trim()
        if (seg.length < 2) continue
        const pid = suffixToProjectMap.get(seg)
        if (pid) {
          linkedProjectId = pid
          break
        }
      }
    }

    // Stratégie 3: Suffixe TIK, GAB, IRAH, BDS, SIG, PAD, AG, ATM, SG... (Fallback)
    if (!linkedProjectId) {
      const opByMatch = odooProjects.find((p) => {
        const pNameNorm = p.name.toLowerCase().trim()
        return (
          pNameNorm === accountNameNorm ||
          accountNameNorm.includes(pNameNorm) ||
          pNameNorm.includes(accountNameNorm)
        )
      })
      if (opByMatch) linkedProjectId = opByMatch.id
    }

    if (!linkedProjectId) continue

    const localProjectId = projectOdooMap.get(linkedProjectId)
    if (!localProjectId) continue

    // Check for existing account by odoo_id or by (project_id, code)
    const { data: existingByOdoo } = await supabase
      .from('analytical_accounts')
      .select('id, odoo_id, project_id, code')
      .eq('odoo_id', oa.id)
      .maybeSingle()

    const accountCode = oa.code || `ODOO_${oa.id}`

    if (existingByOdoo) {
      await supabase
        .from('analytical_accounts')
        .update({
          name: oa.name,
          code: accountCode,
          project_id: localProjectId,
          active: true
        })
        .eq('id', existingByOdoo.id)
    } else {
      // Check if another account already uses this (project_id, code)
      const { data: existingByCode } = await supabase
        .from('analytical_accounts')
        .select('id, odoo_id')
        .eq('project_id', localProjectId)
        .eq('code', accountCode)
        .maybeSingle()

      if (existingByCode) {
        // If it exists but doesn't have an odoo_id, we "claim" it
        if (!existingByCode.odoo_id) {
          await supabase
            .from('analytical_accounts')
            .update({
              name: oa.name,
              odoo_id: oa.id,
              active: true
            })
            .eq('id', existingByCode.id)
        } else {
          // Conflict: different odoo_id has same code. 
          // We must ensure the code is unique to avoid 409.
          const uniqueCode = `${accountCode}_${oa.id}`
          await supabase.from('analytical_accounts').insert({
            name: oa.name,
            code: uniqueCode,
            project_id: localProjectId,
            odoo_id: oa.id,
            active: true
          })
        }
      } else {
        // Standard insert
        await supabase.from('analytical_accounts').insert({
          name: oa.name,
          code: accountCode,
          project_id: localProjectId,
          odoo_id: oa.id,
          active: true
        })
      }
    }
    accountsSynced++
  }

  // Désactiver les comptes analytiques locaux qui ne sont plus dans Odoo pour cette société
  const odooAnalyticalAccountIds = odooAccounts.map((a) => a.id)
  if (odooAnalyticalAccountIds.length > 0) {
    await supabase
      .from('analytical_accounts')
      .update({ active: false })
      .not('odoo_id', 'is', null)
      .not('odoo_id', 'in', `(${odooAnalyticalAccountIds.join(',')})`)
  } else {
    await supabase.from('analytical_accounts').update({ active: false }).not('odoo_id', 'is', null)
  }

  // 6. Synchroniser les comptes comptables
  const odooAccountAccounts = await fetchOdooAccountAccounts(config, uid)
  let accountingAccountsSynced = 0

  for (const oaa of odooAccountAccounts) {
    const concatenatedName = `${oaa.code} ${oaa.name}`
    const accountData = {
      name: concatenatedName,
      code: oaa.code,
      odoo_id: oaa.id,
      active: true
    }
    await supabase.from('accounting_accounts').upsert(accountData, { onConflict: 'odoo_id' })
    accountingAccountsSynced++
  }

  // Désactiver les comptes locaux qui ne sont plus dans Odoo
  const odooAccountAccountIds = odooAccountAccounts.map((a) => a.id)
  if (odooAccountAccountIds.length > 0) {
    await supabase
      .from('accounting_accounts')
      .update({ active: false })
      .not('odoo_id', 'is', null)
      .not('odoo_id', 'in', `(${odooAccountAccountIds.join(',')})`)
  } else {
    await supabase.from('accounting_accounts').update({ active: false }).not('odoo_id', 'is', null)
  }

  // 7. Synchroniser les fournisseurs
  const odooSuppliers = await fetchOdooSuppliers(config, uid)
  let suppliersSynced = 0

  for (const os of odooSuppliers) {
    const supplierData = {
      name: os.name,
      odoo_id: os.id,
      active: true
    }
    await supabase.from('suppliers').upsert(supplierData, { onConflict: 'odoo_id' })
    suppliersSynced++
  }

  // Désactiver les fournisseurs locaux qui ne sont plus dans le filtre Odoo
  const odooSupplierIds = odooSuppliers.map((s) => s.id)
  if (odooSupplierIds.length > 0) {
    await supabase
      .from('suppliers')
      .update({ active: false })
      .not('odoo_id', 'is', null)
      .not('odoo_id', 'in', `(${odooSupplierIds.join(',')})`)
  } else {
    await supabase.from('suppliers').update({ active: false }).not('odoo_id', 'is', null)
  }

  return {
    projects: projectsSynced,
    accounts: accountsSynced,
    suppliers: suppliersSynced,
    accountingAccounts: accountingAccountsSynced
  }
}
