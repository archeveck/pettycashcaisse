import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../services/supabase'
import { Loader2, TrendingUp, TrendingDown, Calendar, FileText, Upload, CheckCircle2 } from 'lucide-react'
import { useNotification } from '../contexts/NotificationContext'
import { getErrorMessage } from '../utils/errorUtils'
import { uploadTransactionProof } from '../services/transactionService'
import { format } from 'date-fns'

interface Transaction {
  id: string
  type: 'inflow' | 'outflow'
  amount: number
  description: string
  date: string
  proof_document_url: string | null
  proof_submitted_at: string | null
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
  const [searchParams] = useSearchParams()
  const { showNotification } = useNotification()

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
  }, [searchParams])

  useEffect(() => {
    if (startDate && endDate && profile) {
      fetchTransactions()
    }
  }, [startDate, endDate, typeFilter, showMissingProof, profile])

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

      setTransactions(data as unknown as Transaction[])
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

  // Calculate totals
  const totalInflows = transactions
    .filter((t) => t.type === 'inflow')
    .reduce((sum, t) => sum + t.amount, 0)

  const totalOutflows = transactions
    .filter((t) => t.type === 'outflow')
    .reduce((sum, t) => sum + t.amount, 0)

  const netBalance = totalInflows - totalOutflows

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Transactions de Caisse</h1>

      {/* Filters */}
      <div className="p-4 bg-card rounded-lg border border-border shadow-sm">
        <h3 className="font-semibold mb-3">Filtres</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <th className="pb-3 font-medium">Justificatif</th>
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
                    <td className="py-3">
                      {t.type === 'outflow' && (
                        <div className="flex items-center gap-2">
                          {t.proof_document_url ? (
                            <a
                              href={t.proof_document_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                              Voir
                            </a>
                          ) : (
                            <>
                              <span className="text-xs text-yellow-600 font-medium whitespace-nowrap">⚠ Manquant</span>
                              {['admin', 'cashier'].includes(profile?.role || '') && (
                                <label className="cursor-pointer p-1 bg-primary/10 hover:bg-primary/20 text-primary rounded transition-colors" title="Ajouter le justificatif">
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
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
