import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { Loader2, Save, Plus, Edit2, Trash2, Settings as SettingsIcon } from 'lucide-react'
import {
  getAppSettings,
  updateAppSetting,
  getProjects,
  createProject,
  updateProject,
  deleteProject,
  getAnalyticalAccounts,
  createAnalyticalAccount,
  updateAnalyticalAccount,
  deleteAnalyticalAccount,
  getUsers,
  updateUserRole,
  getOdooConfig,
  getSuppliers,
  updateSupplier,
  deleteSupplier,
  type Project,
  type AnalyticalAccount,
  type UserProfile,
  type Supplier
} from '../services/settingsService'
import { syncOdooData } from '../services/odooService'
import { getErrorMessage } from '../utils/errorUtils'

type TabType = 'app' | 'projects' | 'accounts' | 'suppliers' | 'users' | 'odoo'

export default function Settings(): React.ReactElement {
  const { profile } = useAuth()
  const [activeTab, setActiveTab] = useState<TabType>('app')
  const [isLoading, setIsLoading] = useState(true)

  // App Settings
  const [maxOutflowLimit, setMaxOutflowLimit] = useState(0)
  const [alertThreshold, setAlertThreshold] = useState(0)
  const [isSavingSettings, setIsSavingSettings] = useState(false)

  // Projects
  const [projects, setProjects] = useState<Project[]>([])
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)

  // Analytical Accounts
  const [accounts, setAccounts] = useState<AnalyticalAccount[]>([])
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<AnalyticalAccount | null>(null)

  // Users
  const [users, setUsers] = useState<UserProfile[]>([])

  // Suppliers
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)

  // Odoo Settings
  const [odooUrl, setOdooUrl] = useState('')
  const [odooDb, setOdooDb] = useState('')
  const [odooUser, setOdooUser] = useState('')
  const [odooPass, setOdooPass] = useState('')
  const [isSavingOdoo, setIsSavingOdoo] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)


  const loadData = useCallback(async (): Promise<void> => {
    setIsLoading(true)
    try {
      if (activeTab === 'app') {
        const settings = await getAppSettings()
        setMaxOutflowLimit(settings.max_outflow_limit)
        setAlertThreshold(settings.alert_threshold)
      } else if (activeTab === 'projects') {
        const data = await getProjects()
        setProjects(data)
      } else if (activeTab === 'accounts') {
        const data = await getAnalyticalAccounts()
        setAccounts(data)
      } else if (activeTab === 'users') {
        const data = await getUsers()
        setUsers(data)
      } else if (activeTab === 'odoo') {
        const config = await getOdooConfig()
        setOdooUrl(config.url)
        setOdooDb(config.db)
        setOdooUser(config.username)
        setOdooPass(config.password || '')
      } else if (activeTab === 'suppliers') {
        const data = await getSuppliers()
        setSuppliers(data)
      }
    } catch (err) {
      console.error('Error loading data:', err)
      alert(`Échec du chargement des données: ${getErrorMessage(err)} `)
    } finally {
      setIsLoading(false)
    }
  }, [activeTab])

  useEffect(() => {
    loadData()
  }, [activeTab, loadData])

  const handleSaveAppSettings = async (): Promise<void> => {
    setIsSavingSettings(true)
    try {
      await updateAppSetting('max_outflow_limit', maxOutflowLimit)
      await updateAppSetting('alert_threshold', alertThreshold)
      alert('Paramètres enregistrés avec succès')
    } catch (err) {
      console.error('Error saving settings:', err)
      alert(`Échec de l'enregistrement des paramètres: ${getErrorMessage(err)}`)
    } finally {
      setIsSavingSettings(false)
    }
  }

  const handleDeleteProject = async (id: string): Promise<void> => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce projet ?')) return
    try {
      await deleteProject(id)
      setProjects((prev) => prev.filter((p) => p.id !== id))
    } catch (err: unknown) {
      alert('Échec de la suppression du projet : ' + getErrorMessage(err))
    }
  }

  const handleDeleteAccount = async (id: string): Promise<void> => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce compte analytique ?')) return
    try {
      await deleteAnalyticalAccount(id)
      setAccounts((prev) => prev.filter((a) => a.id !== id))
    } catch (err: unknown) {
      alert('Échec de la suppression du compte : ' + getErrorMessage(err))
    }
  }

  const handleUpdateUserRole = async (userId: string, role: UserProfile['role']): Promise<void> => {
    try {
      await updateUserRole(userId, role)
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)))
      alert('Rôle utilisateur mis à jour avec succès')
    } catch (err: unknown) {
      alert('Échec de la mise à jour du rôle : ' + getErrorMessage(err))
    }
  }

  const handleDeleteSupplier = async (id: string): Promise<void> => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce fournisseur ?')) return
    try {
      await deleteSupplier(id)
      setSuppliers((prev) => prev.filter((s) => s.id !== id))
    } catch (err: unknown) {
      alert('Échec de la suppression du fournisseur : ' + getErrorMessage(err))
    }
  }

  const handleSaveOdooConfig = async (): Promise<void> => {
    setIsSavingOdoo(true)
    try {
      await updateAppSetting('odoo_url', odooUrl)
      await updateAppSetting('odoo_db', odooDb)
      await updateAppSetting('odoo_username', odooUser)
      if (odooPass) await updateAppSetting('odoo_password', odooPass)
      alert('Configuration Odoo enregistrée')
    } catch (err) {
      alert(`Erreur: ${getErrorMessage(err)}`)
    } finally {
      setIsSavingOdoo(false)
    }
  }

  const handleSyncOdoo = async (): Promise<void> => {
    if (!odooUrl || !odooDb || !odooUser) {
      alert('Veuillez configurer et enregistrer les accès Odoo avant de synchroniser.')
      return
    }

    setIsSyncing(true)
    try {
      const result = await syncOdooData({
        url: odooUrl,
        db: odooDb,
        username: odooUser,
        password: odooPass
      })
      alert(`Synchronisation terminée : ${result.projects} projets, ${result.accounts} comptes et ${result.suppliers} fournisseurs synchronisés.`)
    } catch (err) {
      alert(`Erreur de synchronisation : ${getErrorMessage(err)}`)
    } finally {
      setIsSyncing(false)
    }
  }

  const tabs = [
    { id: 'app' as TabType, label: 'Configuration', icon: SettingsIcon },
    { id: 'odoo' as TabType, label: 'ERP Odoo', icon: SettingsIcon },
    { id: 'projects' as TabType, label: 'Projets', icon: SettingsIcon },
    { id: 'accounts' as TabType, label: 'Comptes Analytiques', icon: SettingsIcon },
    { id: 'suppliers' as TabType, label: 'Fournisseurs', icon: SettingsIcon },
    { id: 'users' as TabType, label: 'Utilisateurs', icon: SettingsIcon }
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Paramètres</h1>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${activeTab === tab.id
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div>
          {/* App Configuration Tab */}
          {activeTab === 'app' && (
            <div className="max-w-2xl space-y-6">
              <div className="p-6 bg-card rounded-lg border border-border shadow-sm space-y-4">
                <h2 className="text-xl font-semibold">Limites de Trésorerie</h2>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Limite Max de Sortie (XOF)</label>
                  <input
                    type="number"
                    value={maxOutflowLimit}
                    onChange={(e) => setMaxOutflowLimit(Number(e.target.value))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Montant maximum autorisé pour une transaction de sortie de caisse
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Seuil d&apos;Alerte (XOF)</label>
                  <input
                    type="number"
                    value={alertThreshold}
                    onChange={(e) => setAlertThreshold(Number(e.target.value))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Alerte lorsque le solde de caisse tombe en dessous de ce montant
                  </p>
                </div>

                <button
                  onClick={handleSaveAppSettings}
                  disabled={isSavingSettings}
                  className="flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {isSavingSettings ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Enregistrer les Paramètres
                </button>
              </div>
            </div>
          )}

          {/* Projects Tab */}
          {activeTab === 'projects' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Projets</h2>
                <button
                  onClick={() => {
                    setEditingProject(null)
                    setIsProjectModalOpen(true)
                  }}
                  className="flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nouveau Projet
                </button>
              </div>

              <div className="grid gap-4">
                {projects.map((project) => (
                  <div
                    key={project.id}
                    className="p-4 bg-card rounded-lg border border-border shadow-sm flex justify-between items-start"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{project.name}</h3>
                        <span className="text-xs bg-secondary px-2 py-1 rounded">
                          {project.code}
                        </span>
                        {!project.active && (
                          <span className="text-xs bg-destructive/20 text-destructive px-2 py-1 rounded">
                            Inactif
                          </span>
                        )}
                      </div>
                      {project.description && (
                        <p className="text-sm text-muted-foreground mt-1">{project.description}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingProject(project)
                          setIsProjectModalOpen(true)
                        }}
                        className="p-2 hover:bg-secondary rounded-md transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteProject(project.id)}
                        className="p-2 hover:bg-destructive/20 text-destructive rounded-md transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Analytical Accounts Tab */}
          {activeTab === 'accounts' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Comptes Analytiques</h2>
                <button
                  onClick={() => {
                    setEditingAccount(null)
                    setIsAccountModalOpen(true)
                  }}
                  className="flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nouveau Compte
                </button>
              </div>

              <div className="grid gap-4">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className="p-4 bg-card rounded-lg border border-border shadow-sm flex justify-between items-start"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{account.name}</h3>
                        <span className="text-xs bg-secondary px-2 py-1 rounded">
                          {account.code}
                        </span>
                      </div>
                      {account.project && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Projet: {account.project.name} ({account.project.code})
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingAccount(account)
                          setIsAccountModalOpen(true)
                        }}
                        className="p-2 hover:bg-secondary rounded-md transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteAccount(account.id)}
                        className="p-2 hover:bg-destructive/20 text-destructive rounded-md transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Accounts Tab Content End */}
          {activeTab === 'accounts' && <div></div>}

          {/* Suppliers Tab */}
          {activeTab === 'suppliers' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Fournisseurs</h2>
              </div>

              <div className="grid gap-4">
                {suppliers.length === 0 ? (
                  <div className="p-8 text-center bg-card rounded-lg border border-dashed border-border text-muted-foreground">
                    Aucun fournisseur trouvé. Synchronisez avec Odoo pour les importer.
                  </div>
                ) : (
                  suppliers.map((supplier) => (
                    <div
                      key={supplier.id}
                      className="p-4 bg-card rounded-lg border border-border shadow-sm flex justify-between items-start"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{supplier.name}</h3>
                          <span className="text-xs bg-secondary px-2 py-1 rounded">
                            ID Odoo: {supplier.odoo_id || 'N/A'}
                          </span>
                          {!supplier.active && (
                            <span className="text-xs bg-destructive/20 text-destructive px-2 py-1 rounded">
                              Inactif
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingSupplier(supplier)
                            setIsSupplierModalOpen(true)
                          }}
                          className="p-2 hover:bg-secondary rounded-md transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteSupplier(supplier.id)}
                          className="p-2 hover:bg-destructive/20 text-destructive rounded-md transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Odoo ERP Tab */}
          {activeTab === 'odoo' && (
            <div className="max-w-2xl space-y-6">
              <div className="p-6 bg-card rounded-lg border border-border shadow-sm space-y-4">
                <h2 className="text-xl font-semibold text-primary">Configuration ERP Odoo</h2>
                <p className="text-sm text-muted-foreground">
                  Synchronisez vos projets et comptes analytiques directement depuis Odoo.
                </p>

                <div className="grid gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">URL Odoo (ex: https://monerp.com)</label>
                    <input
                      type="url"
                      value={odooUrl}
                      onChange={(e) => setOdooUrl(e.target.value)}
                      placeholder="https://"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Base de données</label>
                    <input
                      type="text"
                      value={odooDb}
                      onChange={(e) => setOdooDb(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Nom d&apos;utilisateur / Email</label>
                      <input
                        type="text"
                        value={odooUser}
                        onChange={(e) => setOdooUser(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Mot de passe / Clé API</label>
                      <input
                        type="password"
                        value={odooPass}
                        onChange={(e) => setOdooPass(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4 border-t border-border">
                  <button
                    onClick={handleSaveOdooConfig}
                    disabled={isSavingOdoo || isSyncing}
                    className="flex-1 flex items-center justify-center px-4 py-2 border border-primary text-primary rounded-md hover:bg-primary/10 transition-colors disabled:opacity-50"
                  >
                    {isSavingOdoo ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Enregistrer la config
                  </button>

                  <button
                    onClick={handleSyncOdoo}
                    disabled={isSavingOdoo || isSyncing}
                    className="flex-1 flex items-center justify-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {isSyncing ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4 mr-2" />
                    )}
                    Synchroniser maintenant
                  </button>
                </div>

                {isSyncing && (
                  <p className="text-sm text-blue-600 animate-pulse text-center">
                    Synchronisation en cours... veuillez patienter.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Gestion des Utilisateurs</h2>

              <div className="grid gap-4">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="p-4 bg-card rounded-lg border border-border shadow-sm flex justify-between items-center"
                  >
                    <div>
                      <h3 className="font-semibold">{user.full_name || 'Sans Nom'}</h3>
                      <p className="text-sm text-muted-foreground">{user.id}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <select
                        value={user.role}
                        onChange={(e) =>
                          handleUpdateUserRole(user.id, e.target.value as UserProfile['role'])
                        }
                        disabled={user.id === profile?.id}
                        className="px-3 py-2 border border-input rounded-md bg-background text-sm disabled:opacity-50"
                      >
                        <option value="requester">Demandeur</option>
                        <option value="cashier">Caissier</option>
                        <option value="controller">Contrôleur</option>
                        <option value="cfo">DAF</option>
                        <option value="admin">Administrateur</option>
                      </select>
                      {user.id === profile?.id && (
                        <span className="text-xs text-muted-foreground">(Vous)</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Project Modal */}
      {isProjectModalOpen && (
        <ProjectModal
          project={editingProject}
          onClose={() => setIsProjectModalOpen(false)}
          onSave={() => {
            setIsProjectModalOpen(false)
            loadData()
          }}
        />
      )}

      {/* Account Modal */}
      {isAccountModalOpen && (
        <AccountModal
          account={editingAccount}
          projects={projects}
          onClose={() => setIsAccountModalOpen(false)}
          onSave={() => {
            setIsAccountModalOpen(false)
            loadData()
          }}
        />
      )}

      {/* Supplier Modal */}
      {isSupplierModalOpen && (
        <SupplierModal
          supplier={editingSupplier}
          onClose={() => setIsSupplierModalOpen(false)}
          onSave={() => {
            setIsSupplierModalOpen(false)
            loadData()
          }}
        />
      )}
    </div>
  )
}

// Project Modal Component
function ProjectModal({
  project,
  onClose,
  onSave
}: {
  project: Project | null
  onClose: () => void
  onSave: () => void
}): React.ReactElement {
  const [name, setName] = useState(project?.name || '')
  const [code, setCode] = useState(project?.code || '')
  const [description, setDescription] = useState(project?.description || '')
  const [active, setActive] = useState(project?.active ?? true)
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setIsSaving(true)

    try {
      if (project) {
        await updateProject(project.id, { name, code, description, active })
      } else {
        await createProject({ name, code, description, active })
      }
      onSave()
    } catch (err: unknown) {
      alert("Échec de l'enregistrement du projet : " + getErrorMessage(err))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card p-6 rounded-lg border border-border shadow-lg max-w-md w-full">
        <h2 className="text-xl font-semibold mb-4">
          {project ? 'Modifier le Projet' : 'Nouveau Projet'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Nom</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Code</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="active"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="active" className="text-sm font-medium">
              Actif
            </label>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-border rounded-md hover:bg-secondary transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Account Modal Component
function AccountModal({
  account,
  projects,
  onClose,
  onSave
}: {
  account: AnalyticalAccount | null
  projects: Project[]
  onClose: () => void
  onSave: () => void
}): React.ReactElement {
  const [name, setName] = useState(account?.name || '')
  const [code, setCode] = useState(account?.code || '')
  const [projectId, setProjectId] = useState(account?.project_id || '')
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setIsSaving(true)

    try {
      if (account) {
        await updateAnalyticalAccount(account.id, { name, code, project_id: projectId })
      } else {
        await createAnalyticalAccount({ name, code, project_id: projectId })
      }
      onSave()
    } catch (err: unknown) {
      alert("Échec de l'enregistrement du compte : " + getErrorMessage(err))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card p-6 rounded-lg border border-border shadow-lg max-w-md w-full">
        <h2 className="text-xl font-semibold mb-4">
          {account ? 'Modifier le Compte Analytique' : 'Nouveau Compte Analytique'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Projet</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Sélectionner un projet</option>
              {projects
                .filter((p) => p.active)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Nom</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Code</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-border rounded-md hover:bg-secondary transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Supplier Modal Component
function SupplierModal({
  supplier,
  onClose,
  onSave
}: {
  supplier: Supplier | null
  onClose: () => void
  onSave: () => void
}): React.ReactElement {
  const [name, setName] = useState(supplier?.name || '')
  const [active, setActive] = useState(supplier?.active ?? true)
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setIsSaving(true)

    try {
      if (supplier) {
        await updateSupplier(supplier.id, { name, active })
      }
      onSave()
    } catch (err: unknown) {
      alert("Échec de l'enregistrement du fournisseur : " + getErrorMessage(err))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card p-6 rounded-lg border border-border shadow-lg max-w-md w-full">
        <h2 className="text-xl font-semibold mb-4">
          {supplier ? 'Modifier le Fournisseur' : 'Nouveau Fournisseur'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Nom</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="supplier-active"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="supplier-active" className="text-sm font-medium">
              Actif
            </label>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-border rounded-md hover:bg-secondary transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
