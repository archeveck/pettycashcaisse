import { authenticateOdoo, odooCall } from './src/renderer/src/services/odooService'
import { getOdooConfig } from './src/renderer/src/services/settingsService'

async function debug() {
  try {
    const config = await getOdooConfig()
    const uid = await authenticateOdoo(config)

    console.log('Fetching fields for account.analytic.account...')
    const fields = await odooCall(config, 'object', 'execute_kw', [
      config.db,
      uid,
      config.password,
      'account.analytic.account',
      'fields_get',
      [],
      { attributes: ['string', 'type', 'relation'] }
    ])
    console.log(
      'Analytical Account Fields:',
      Object.keys(fields).filter((f) => f.includes('project'))
    )

    console.log('Fetching fields for project.project...')
    const pFields = await odooCall(config, 'object', 'execute_kw', [
      config.db,
      uid,
      config.password,
      'project.project',
      'fields_get',
      [],
      { attributes: ['string', 'type', 'relation'] }
    ])
    console.log(
      'Project Fields:',
      Object.keys(pFields).filter((f) => f.includes('analytic'))
    )
  } catch (e) {
    console.error(e)
  }
}
