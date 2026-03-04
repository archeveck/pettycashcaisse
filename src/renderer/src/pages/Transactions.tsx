import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../services/supabase'
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  Calendar,
  FileText,
  Upload,
  CheckCircle2,
  Printer,
  DollarSign
} from 'lucide-react'
import { useNotification } from '../contexts/NotificationContext'
import { getErrorMessage } from '../utils/errorUtils'
import { uploadTransactionProof } from '../services/transactionService'
import { getProjects, getAnalyticalAccounts, Project, AnalyticalAccount } from '../services/settingsService'
import CashVoucher, { VoucherData, BulkPrintData } from '../components/CashVoucher'
import { format } from 'date-fns'

interface Transaction {
  id: string
  type: 'inflow' | 'outflow'
  amount: number
  description: string
  date: string
  proof_document_url: string | null
  proof_submitted_at: string | null
  change_amount?: number
  created_by: string
  creator?: {
    full_name: string
  }
  request?: {
    id: string
    requester: {
      full_name: string
    }
  }
  analytical_account?: {
    code: string
    name: string
    project: {
      name: string
    }
    project_id?: string
  }
}

export default function Transactions(): React.ReactElement {
  const { profile } = useAuth()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'inflow' | 'outflow'>('all')
  const [isUploadingProof, setIsUploadingProof] = useState<string | null>(null)
  const [showMissingProof, setShowMissingProof] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [accounts, setAccounts] = useState<AnalyticalAccount[]>([])
  const [selectedProject, setSelectedProject] = useState('')
  const [selectedAccount, setSelectedAccount] = useState('')
  const [printData, setPrintData] = useState<VoucherData | BulkPrintData | null>(null)
  const [searchParams] = useSearchParams()
  const { showNotification } = useNotification()

  // Return change modal state
  const [isReturnChangeModalOpen, setIsReturnChangeModalOpen] = useState(false)
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null)
  const [changeAmount, setChangeAmount] = useState(0)
  const [isProcessingReturnChange, setIsProcessingReturnChange] = useState(false)

  useEffect(() => {
    const end = new Date()
    const start = new Date()

    // If filtering for missing proofs, expand date range to find old ones
    if (searchParams.get('filter') === 'missing_proof') {
      start.setFullYear(start.getFullYear() - 1) // 1 year instead of 30 days
      setShowMissingProof(true)
    } else {
      start.setDate(start.getDate() - 30)
    }

    setStartDate(start.toISOString().split('T')[0])
    setEndDate(end.toISOString().split('T')[0])

    // Fetch filter data
    const loadFilterData = async (): Promise<void> => {
      try {
        const [projData, accData] = await Promise.all([getProjects(), getAnalyticalAccounts()])
        setProjects(projData)
        setAccounts(accData)
      } catch (err) {
        console.error('Error loading filter data:', err)
      }
    }
    loadFilterData()
  }, [searchParams])

  useEffect(() => {
    if (startDate && endDate && profile) {
      fetchTransactions()
    }
  }, [startDate, endDate, typeFilter, showMissingProof, selectedProject, selectedAccount, profile])

  const fetchTransactions = async (): Promise<void> => {
    if (!profile) return

    setIsLoading(true)
    try {
      let query = supabase
        .from('cash_transactions')
        .select(
          `
          *,
          creator:profiles!created_by (
            full_name
          ),
          request:cash_requests (
            id,
            requester:profiles!requester_id (
              full_name
            )
          ),
          analytical_account:analytical_accounts (
            code,
            name,
            project_id,
            project:projects (
              name
            )
          )
        `
        )
        .gte('date', `${startDate}T00:00:00`)
        .lte('date', `${endDate}T23:59:59`)
        .order('date', { ascending: false })

      // Filter by type if not 'all'
      if (typeFilter !== 'all') {
        query = query.eq('type', typeFilter)
      }

      if (showMissingProof) {
        query = query.eq('type', 'outflow').is('proof_document_url', null)
      }

      if (selectedAccount) {
        query = query.eq('analytical_account_id', selectedAccount)
      }

      // For requesters, only show their own transactions (outflows from their requests)
      if (profile.role === 'requester') {
        // Get requester's request IDs
        const { data: userRequests } = await supabase
          .from('cash_requests')
          .select('id')
          .eq('requester_id', profile.id)

        const requestIds = userRequests?.map((r) => r.id) || []

        if (requestIds.length > 0) {
          query = query.in('request_id', requestIds)
        } else {
          // No requests, no transactions
          setTransactions([])
          setIsLoading(false)
          return
        }
      }

      const { data, error } = await query

      if (error) throw error

      let filtered = data as unknown as Transaction[]

      if (selectedProject) {
        filtered = filtered.filter((t) => t.analytical_account?.project_id === selectedProject)
      }

      setTransactions(filtered)
    } catch (err) {
      console.error('Error fetching transactions:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdateProof = async (transactionId: string, file: File): Promise<void> => {
    console.log('Starting proof update for transaction:', transactionId, file.name)
    setIsUploadingProof(transactionId)
    try {
      await uploadTransactionProof(transactionId, file)
      console.log('Proof update successful')
      showNotification('Justificatif ajouté avec succès !', 'success')
      fetchTransactions() // Refresh list
    } catch (err) {
      console.error('Error uploading proof:', err)
      showNotification(`Échec de l'ajout du justificatif: ${getErrorMessage(err)}`, 'error')
    } finally {
      setIsUploadingProof(null)
    }
  }

  const handleReturnChange = async (): Promise<void> => {
    if (!selectedTransactionId || changeAmount < 0) return
    setIsProcessingReturnChange(true)
    try {
      const { error } = await supabase
        .from('cash_transactions')
        .update({ change_amount: changeAmount })
        .eq('id', selectedTransactionId)

      if (error) throw error

      showNotification('Retour monnaie enregistré avec succès !', 'success')
      setIsReturnChangeModalOpen(false)
      setSelectedTransactionId(null)
      setChangeAmount(0)
      fetchTransactions()
    } catch (err: unknown) {
      console.error('Error recording return change:', err)
      showNotification(`Échec de l'enregistrement du retour monnaie: ${getErrorMessage(err)}`, 'error')
    } finally {
      setIsProcessingReturnChange(false)
    }
  }

  const openReturnChangeModal = (transaction: Transaction): void => {
    setSelectedTransactionId(transaction.id)
    setChangeAmount(transaction.change_amount || 0)
    setIsReturnChangeModalOpen(true)
  }

  // Calculate totals
  const totalInflows = transactions
    .filter((t) => t.type === 'inflow')
    .reduce((sum, t) => sum + t.amount, 0)

  const totalOutflows = transactions
    .filter((t) => t.type === 'outflow')
    .reduce((sum, t) => sum + (t.amount - (t.change_amount || 0)), 0)

  const netBalance = totalInflows - totalOutflows

  const handlePrintIndividual = (t: Transaction): void => {
    const data: VoucherData = {
      transactionId: t.id,
      date: t.date,
      requesterName: t.request?.requester.full_name || t.creator?.full_name || 'N/A',
      amount: t.amount,
      description: t.description,
      analyticalAccount: {
        code: t.analytical_account?.code || 'N/A',
        name: t.analytical_account?.name || 'N/A',
        project: {
          name: t.analytical_account?.project?.name || 'N/A'
        }
      },
      cashierName: t.creator?.full_name,
      proof_document_url: t.proof_document_url
    }
    setPrintData(data)
  }

  const handlePrintAll = (): void => {
    const inflows = transactions.filter((t) => t.type === 'outflow')
    if (inflows.length === 0) {
      showNotification('Aucune transaction de sortie à imprimer.', 'info')
      return
    }

    const vouchers: VoucherData[] = inflows.map((t) => ({
      transactionId: t.id,
      date: t.date,
      requesterName: t.request?.requester.full_name || t.creator?.full_name || 'N/A',
      amount: t.amount,
      description: t.description,
      analyticalAccount: {
        code: t.analytical_account?.code || 'N/A',
        name: t.analytical_account?.name || 'N/A',
        project: {
          name: t.analytical_account?.project?.name || 'N/A'
        }
      },
      cashierName: t.creator?.full_name,
      proof_document_url: t.proof_document_url
    }))

    setPrintData({ vouchers })
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Transactions de Caisse</h1>
        {['admin', 'cashier'].includes(profile?.role || '') && (
          <button
            onClick={handlePrintAll}
            disabled={transactions.filter((t) => t.type === 'outflow').length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
            title="Génère un PDF fusionné de toutes les sorties avec leurs justificatifs, puis ouvre l'impression"
          >
            <FileText className="w-4 h-4" />
            Fusionner & Imprimer (Sorties)
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="p-4 bg-card rounded-lg border border-border shadow-sm">
        <h3 className="font-semibold mb-3">Filtres</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Date de Début</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Date de Fin</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as 'all' | 'inflow' | 'outflow')}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="all">Tous</option>
              <option value="inflow">Entrée</option>
              <option value="outflow">Sortie</option>
            </select>
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={showMissingProof}
                onChange={(e) => setShowMissingProof(e.target.checked)}
                className="w-4 h-4 rounded border-input bg-background"
              />
              <span className="text-sm font-medium text-yellow-600 group-hover:text-yellow-700">
                Justificatifs Manquants Uniquement
              </span>
            </label>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Projet</label>
            <select
              value={selectedProject}
              onChange={(e) => {
                setSelectedProject(e.target.value)
                setSelectedAccount('')
              }}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Tous les projets</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Compte Analytique</label>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Tous les comptes</option>
              {(selectedProject
                ? accounts.filter((a) => a.project_id === selectedProject)
                : accounts
              ).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} - {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="p-6 bg-card rounded-lg border border-border shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <h3 className="text-sm font-medium text-muted-foreground">Total Entrées</h3>
          </div>
          <p className="text-2xl font-bold text-green-600">
            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(
              totalInflows
            )}
          </p>
        </div>

        <div className="p-6 bg-card rounded-lg border border-border shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-5 h-5 text-red-600" />
            <h3 className="text-sm font-medium text-muted-foreground">Total Sorties</h3>
          </div>
          <p className="text-2xl font-bold text-red-600">
            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(
              totalOutflows
            )}
          </p>
        </div>

        <div className="p-6 bg-card rounded-lg border border-border shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-medium text-muted-foreground">Solde Net</h3>
          </div>
          <p className={`text-2xl font-bold ${netBalance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(
              netBalance
            )}
          </p>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="p-6 bg-card rounded-lg border border-border shadow-sm">
        <h3 className="text-lg font-semibold mb-4">Transactions ({transactions.length})</h3>

        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Aucune transaction trouvée pour la période sélectionnée.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr className="text-left">
                  <th className="pb-3 font-medium">Date</th>
                  <th className="pb-3 font-medium">Type</th>
                  <th className="pb-3 font-medium">Montant</th>
                  <th className="pb-3 font-medium">Description</th>
                  {profile?.role !== 'requester' && (
                    <>
                      <th className="pb-3 font-medium">Créé Par</th>
                      <th className="pb-3 font-medium">Compte</th>
                    </>
                  )}
                  {profile?.role === 'requester' && <th className="pb-3 font-medium">Statut</th>}
                  <th className="pb-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} className="border-b border-border hover:bg-muted/50">
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        {format(new Date(t.date), 'MMM d, yyyy HH:mm')}
                      </div>
                    </td>
                    <td className="py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${t.type === 'inflow'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          }`}
                      >
                        {t.type === 'inflow' ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        {t.type}
                      </span>
                    </td>
                    <td className="py-3 font-medium">
                      {new Intl.NumberFormat('fr-FR', {
                        style: 'currency',
                        currency: 'XOF'
                      }).format(t.amount)}
                    </td>
                    <td className="py-3 max-w-xs truncate">{t.description}</td>
                    {profile?.role !== 'requester' && (
                      <>
                        <td className="py-3 text-sm">
                          {t.type === 'outflow' && t.request
                            ? t.request.requester.full_name
                            : t.creator?.full_name || 'Système'}
                        </td>
                        <td className="py-3 text-xs">
                          {t.analytical_account ? (
                            <>
                              <div className="font-medium">{t.analytical_account.code}</div>
                              <div className="text-muted-foreground">
                                {t.analytical_account.project?.name}
                              </div>
                            </>
                          ) : (
                            <span className="text-muted-foreground">N/D</span>
                          )}
                        </td>
                      </>
                    )}
                    {profile?.role === 'requester' && (
                      <td className="py-3">
                        <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          Décaisser
                        </span>
                      </td>
                    )}
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {t.type === 'outflow' && (
                          <button
                            onClick={() => handlePrintIndividual(t)}
                            className="p-1 text-primary hover:bg-primary/10 rounded transition-colors"
                            title="Imprimer la pièce de caisse"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        )}
                        {t.type === 'outflow' && ['admin', 'cashier'].includes(profile?.role || '') && (
                          <button
                            onClick={() => openReturnChangeModal(t)}
                            className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded transition-colors whitespace-nowrap ${t.change_amount && t.change_amount > 0 ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-blue-100 text-blue-700 hover:bg-blue-100'}`}
                            title="Gérer le retour monnaie"
                          >
                            <DollarSign className="w-3 h-3" />
                            {t.change_amount && t.change_amount > 0
                              ? `${new Intl.NumberFormat('fr-FR').format(t.change_amount)}`
                              : 'Retour'}
                          </button>
                        )}
                        <div className="flex items-center gap-2">
                          {t.proof_document_url ? (
                            <a
                              href={t.proof_document_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                              Voir Justif
                            </a>
                          ) : t.type === 'outflow' ? (
                            <>
                              <span className="text-xs text-yellow-600 font-medium whitespace-nowrap">
                                ⚠ Pas de Justif
                              </span>
                              {['admin', 'cashier'].includes(profile?.role || '') && (
                                <label
                                  className="cursor-pointer p-1 bg-primary/10 hover:bg-primary/20 text-primary rounded transition-colors"
                                  title="Ajouter le justificatif"
                                >
                                  {isUploadingProof === t.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Upload className="w-3.5 h-3.5" />
                                  )}
                                  <input
                                    type="file"
                                    className="hidden"
                                    accept="image/*,application/pdf"
                                    value=""
                                    onChange={(e) => {
                                      const file = e.target.files?.[0]
                                      console.log('File selected:', file?.name)
                                      if (file) handleUpdateProof(t.id, file)
                                    }}
                                    disabled={!!isUploadingProof}
                                  />
                                </label>
                              )}
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Entrée</span>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {printData && (
        <CashVoucher data={printData} onClose={() => setPrintData(null)} />
      )}

      {/* Return Change Modal */}
      {isReturnChangeModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded-lg border border-border shadow-lg max-w-md w-full">
            <h2 className="text-xl font-semibold mb-4">Retour Monnaie</h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Montant du retour (FCFA)</label>
                <input
                  type="number"
                  value={changeAmount || ''}
                  onChange={(e) => setChangeAmount(Number(e.target.value))}
                  placeholder="Entrer le montant du retour"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  autoFocus
                />
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setIsReturnChangeModalOpen(false)}
                  disabled={isProcessingReturnChange}
                  className="px-4 py-2 border border-border rounded-md hover:bg-secondary transition-colors disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleReturnChange}
                  disabled={isProcessingReturnChange}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isProcessingReturnChange ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Traitement...
                    </>
                  ) : (
                    'Enregistrer le retour'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
