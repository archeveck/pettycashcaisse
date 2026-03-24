import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { useAuth } from '../hooks/useAuth'
import { useNotification } from '../contexts/NotificationContext'
import { getErrorMessage } from '../utils/errorUtils'
import { getAppSettings } from '../services/settingsService'
import {
  Loader2,
  DollarSign,
  Lock,
  Plus,
  AlertCircle,
  Upload,
  CheckCircle2,
  History as HistoryIcon,
  Printer
} from 'lucide-react'
import CashVoucher, { VoucherData } from '../components/CashVoucher'
import { uploadTransactionProof } from '../services/transactionService'
import { format } from 'date-fns'

interface Transaction {
  id: string
  type: 'inflow' | 'outflow'
  amount: number
  description: string
  date: string
  proof_document_url: string | null
  change_amount?: number
  request_id?: string
  request?: {
    id: string
    proof_document_url?: string | null
    requester: {
      full_name: string
    }
    analytical_account: {
      code: string
      name: string
      project: {
        name: string
      }
    }
  }
}

interface CashRequest {
  id: string
  amount: number
  description: string
  status: string
  created_at: string
  analytical_account_id: string
  requester: {
    full_name: string
  }
  analytical_account: {
    code: string
    name: string
    project: {
      name: string
    }
  }
  proof_document_url?: string | null
}

export default function CashierDashboard(): React.ReactElement {
  const { profile } = useAuth()
  const { showNotification } = useNotification()
  const [approvedRequests, setApprovedRequests] = useState<CashRequest[]>([])
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [balance, setBalance] = useState(0)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [selectedRequest, setSelectedRequest] = useState<CashRequest | null>(null)
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [maxOutflowLimit, setMaxOutflowLimit] = useState<number>(0)

  // Inflow modal state
  const [isInflowModalOpen, setIsInflowModalOpen] = useState(false)
  const [inflowAmount, setInflowAmount] = useState(0)
  const [inflowDescription, setInflowDescription] = useState('')
  const [isProcessingInflow, setIsProcessingInflow] = useState(false)

  // Upload state
  const [isUploadingProof, setIsUploadingProof] = useState<string | null>(null)
  const [voucherData, setVoucherData] = useState<VoucherData | null>(null)

  // Return change modal state
  const [isReturnChangeModalOpen, setIsReturnChangeModalOpen] = useState(false)
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null)
  const [changeAmount, setChangeAmount] = useState(0)
  const [isProcessingReturnChange, setIsProcessingReturnChange] = useState(false)

  useEffect(() => {
    fetchData()
    fetchSettings()
  }, [])

  const fetchSettings = async (): Promise<void> => {
    try {
      const settings = await getAppSettings()
      setMaxOutflowLimit(settings.max_outflow_limit)
    } catch (err: unknown) {
      console.error('Error fetching settings:', err)
    }
  }

  const fetchData = async (): Promise<void> => {
    setIsLoading(true)
    try {
      // Fetch Approved Requests
      const { data: requests, error: reqError } = await supabase
        .from('cash_requests')
        .select(
          `
          id,
          amount,
          description,
          status,
          created_at,
          analytical_account_id,
          proof_document_url,
          requester:profiles (
            full_name
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
        .eq('status', 'approved')
        .order('created_at', { ascending: true })

      if (reqError) throw reqError
      setApprovedRequests(requests as unknown as CashRequest[])

      // Fetch Recent Transactions
      const { data: recentTrans, error: recentError } = await supabase
        .from('cash_transactions')
        .select(
          `
          id,
          type,
          amount,
          description,
          date,
          proof_document_url,
          change_amount,
          request_id,
          request:cash_requests (
            id,
            proof_document_url,
            requester:profiles (
              full_name
            ),
            analytical_account:analytical_accounts (
              code,
              name,
              project:projects (
                name
              )
            )
          )
        `
        )
        .order('date', { ascending: false })
        .limit(10)

      if (recentError) throw recentError
      setRecentTransactions(recentTrans as unknown as Transaction[])

      // Calculate Balance (Simplified - in real app, fetch from daily_closures or aggregate transactions)
      // For MVP, let's just sum inflows - outflows
      const { data: transactions, error: transError } = await supabase
        .from('cash_transactions')
        .select('type, amount, change_amount')

      if (transError) throw transError

      const currentBalance =
        transactions?.reduce((acc, curr) => {
          const amount = curr.amount
          return curr.type === 'inflow' ? acc + amount : acc - amount
        }, 0) || 0

      setBalance(currentBalance)
    } catch (err: unknown) {
      console.error('Error fetching cashier data:', err)
      showNotification(
        `Erreur lors du chargement des données de la caisse: ${getErrorMessage(err)}`,
        'error'
      )
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
      fetchData() // Refresh list
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
      // 1. Fetch original transaction details
      const { data: originalTx, error: fetchErr } = await supabase
        .from('cash_transactions')
        .select('*')
        .eq('id', selectedTransactionId)
        .single()

      if (fetchErr) throw fetchErr

      // 2. Insert new inflow transaction for the returned change
      const { error: insertError } = await supabase
        .from('cash_transactions')
        .insert({
          type: 'inflow',
          amount: changeAmount,
          description: `Retour monnaie sur: ${originalTx.description}`,
          created_by: profile?.id,
          analytical_account_id: originalTx.analytical_account_id,
          request_id: originalTx.request_id,
          accounting_account_id: originalTx.accounting_account_id
        })

      if (insertError) throw insertError

      // 3. Update change_amount on the original transaction for UI indicators
      const { error: updateError } = await supabase
        .from('cash_transactions')
        .update({ change_amount: changeAmount })
        .eq('id', selectedTransactionId)

      if (updateError) throw updateError

      showNotification('Retour monnaie enregistré avec succès !', 'success')
      setIsReturnChangeModalOpen(false)
      setSelectedTransactionId(null)
      setChangeAmount(0)
      fetchData()
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

  const handlePrintVoucher = (transaction: Transaction): void => {
    if (transaction.type === 'outflow' && transaction.request) {
      setVoucherData({
        transactionId: transaction.id,
        date: transaction.date,
        requesterName: transaction.request.requester.full_name,
        amount: transaction.amount,
        description: transaction.description,
        analyticalAccount: transaction.request.analytical_account,
        cashierName: profile?.full_name,
        proof_document_url: transaction.proof_document_url
      })
    }
  }

  const handleDisburse = async (request: CashRequest, proofFile?: File): Promise<void> => {
    if (!profile) return

    // Check limit
    if (maxOutflowLimit > 0 && request.amount > maxOutflowLimit) {
      showNotification(
        `Le montant de ${request.amount.toLocaleString('fr-FR')} FCFA dépasse la limite maximale de ${maxOutflowLimit.toLocaleString('fr-FR')} FCFA`,
        'warning'
      )
      return
    }

    if (balance < request.amount) {
      showNotification(
        `Solde insuffisant: ${balance.toLocaleString('fr-FR')} FCFA pour un décaissement de ${request.amount.toLocaleString('fr-FR')} FCFA`,
        'warning'
      )
      return
    }

    setProcessingId(request.id)

    try {
      let proofDocumentUrl: string | null = null

      // Upload proof document if provided
      if (proofFile) {
        const fileExt = proofFile.name.split('.').pop()
        const fileName = `${request.id}_${Date.now()}.${fileExt}`
        const filePath = `${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('proof-documents')
          .upload(filePath, proofFile)

        if (uploadError) throw uploadError

        // Get public URL
        const { data: urlData } = supabase.storage.from('proof-documents').getPublicUrl(filePath)

        proofDocumentUrl = urlData.publicUrl
      }

      // 1. Create Transaction
      const { error: transError } = await supabase.from('cash_transactions').insert({
        type: 'outflow',
        amount: request.amount,
        description: request.description,
        created_by: profile.id,
        analytical_account_id: request.analytical_account_id,
        request_id: request.id,
        proof_document_url: proofDocumentUrl,
        proof_submitted_at: proofFile ? new Date().toISOString() : null
      })

      if (transError) throw transError

      // 2. Update Request Status
      const { error: reqError } = await supabase
        .from('cash_requests')
        .update({ status: 'disbursed' })
        .eq('id', request.id)

      if (reqError) throw reqError

      // Refresh
      setSelectedRequest(null)
      setProofFile(null)
      fetchData()
      showNotification('Décaissement enregistré avec succès !', 'success')
    } catch (err: unknown) {
      console.error('Disbursement error:', err)
      showNotification(`Échec du traitement du décaissement : ${getErrorMessage(err)}`, 'error')
    } finally {
      setProcessingId(null)
    }
  }

  const openDisburseModal = (request: CashRequest): void => {
    setSelectedRequest(request)
    setProofFile(null)
  }

  const confirmDisburse = (): void => {
    if (selectedRequest) {
      handleDisburse(selectedRequest, proofFile || undefined)
    }
  }

  const handleInflow = async (): Promise<void> => {
    if (!profile || inflowAmount <= 0) {
      showNotification('Veuillez entrer un montant valide', 'warning')
      return
    }

    setIsProcessingInflow(true)

    try {
      const { error } = await supabase.from('cash_transactions').insert({
        type: 'inflow',
        amount: inflowAmount,
        description: inflowDescription || 'Entrée de caisse',
        created_by: profile.id,
        date: new Date().toISOString()
      })

      if (error) throw error

      // Reset and close modal
      setIsInflowModalOpen(false)
      setInflowAmount(0)
      setInflowDescription('')
      fetchData()
      showNotification('Entrée de caisse enregistrée avec succès !', 'success')
    } catch (err: unknown) {
      console.error('Inflow error:', err)
      showNotification(`Échec de l'enregistrement de l'entrée : ${getErrorMessage(err)}`, 'error')
    } finally {
      setIsProcessingInflow(false)
    }
  }

  const openInflowModal = (): void => {
    setInflowAmount(0)
    setInflowDescription('')
    setIsInflowModalOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Caisse</h1>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Solde Actuel</p>
            <p
              className={`text-2xl font-bold ${balance < 50000 ? 'text-red-600' : 'text-foreground'}`}
            >
              {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(
                balance
              )}
            </p>
          </div>
          <button
            onClick={openInflowModal}
            className="p-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            title="Ajouter une Entrée de Caisse"
          >
            <Plus className="w-5 h-5" />
          </button>
          <button
            onClick={() => (window.location.hash = '#/cashier/closure')}
            className="p-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            title="Clôture Journalière"
          >
            <Lock className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Pending Disbursements */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Décaissements en Attente ({approvedRequests.length})
          </h2>

          {isLoading ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : approvedRequests.length === 0 ? (
            <p className="text-muted-foreground">
              Aucune demande approuvée en attente de décaissement.
            </p>
          ) : (
            <div className="space-y-3">
              {approvedRequests.map((req) => (
                <div key={req.id} className="p-4 bg-card border border-border rounded-lg shadow-sm">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2 gap-2">
                    <div>
                      <p className="font-medium">{req.requester.full_name}</p>
                      <p className="text-sm text-muted-foreground">{req.description}</p>
                    </div>
                    <span className="font-bold text-lg">
                      {new Intl.NumberFormat('fr-FR', {
                        style: 'currency',
                        currency: 'XOF'
                      }).format(req.amount)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-4">
                    <span className="text-xs bg-secondary px-2 py-1 rounded">
                      {req.analytical_account.code}
                    </span>
                    <button
                      onClick={() => openDisburseModal(req)}
                      disabled={!!processingId}
                      className="px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      Décaisser
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Transactions */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <HistoryIcon className="w-5 h-5" />
            Transactions Récentes
          </h2>
          {isLoading ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : recentTransactions.length === 0 ? (
            <div className="p-4 bg-muted/20 rounded-lg border border-border border-dashed h-64 flex items-center justify-center text-muted-foreground">
              L&apos;historique des transactions apparaîtra ici
            </div>
          ) : (
            <div className="space-y-3">
              {recentTransactions.map((t) => (
                <div key={t.id} className="p-3 bg-card border border-border rounded-lg shadow-sm">
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                    <div className="flex gap-3">
                      <div
                        className={`mt-1 p-1.5 rounded-full ${t.type === 'inflow' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                      >
                        {t.type === 'inflow' ? (
                          <Plus className="w-3 h-3" />
                        ) : (
                          <DollarSign className="w-3 h-3" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium leading-none">
                          {t.type === 'outflow'
                            ? t.request?.requester.full_name
                            : 'Entrée de caisse'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">{t.description}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {format(new Date(t.date), 'dd/MM/yyyy HH:mm')}
                        </p>
                      </div>
                    </div>
                    <div className="text-left sm:text-right mt-2 sm:mt-0 w-full sm:w-auto flex flex-col items-start sm:items-end">
                      <p
                        className={`text-sm font-bold ${t.type === 'inflow' ? 'text-green-600' : 'text-foreground'}`}
                      >
                        {t.type === 'inflow' ? '+' : '-'}{' '}
                        {new Intl.NumberFormat('fr-FR').format(t.amount)}
                      </p>
                      {t.type === 'outflow' && (
                        <div className="mt-2 flex justify-end">
                          {(() => {
                            const activeProofUrl = t.proof_document_url || t.request?.proof_document_url
                            if (activeProofUrl) {
                              return (
                                <a
                                  href={activeProofUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-blue-600 hover:underline flex items-center gap-1"
                                >
                                  <CheckCircle2 className="w-3 h-3 text-green-600" />
                                  Justificatif
                                </a>
                              )
                            } else {
                              return (
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-red-500 font-medium">
                                    Justificatif Manquant
                                  </span>
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
                                </div>
                              )
                            }
                          })()}
                        </div>
                      )}
                      {t.type === 'outflow' && t.request && (
                        <button
                          onClick={() => handlePrintVoucher(t)}
                          className="mt-2 inline-flex items-center gap-1 px-2 py-1 text-[10px] bg-secondary hover:bg-secondary/80 rounded transition-colors"
                          title="Imprimer la pièce de caisse"
                        >
                          <Printer className="w-3 h-3" />
                          Imprimer
                        </button>
                      )}
                      {t.type === 'outflow' && (
                        <button
                          onClick={() => openReturnChangeModal(t)}
                          className={`mt-2 inline-flex items-center gap-1 px-2 py-1 text-[10px] rounded transition-colors ${t.change_amount && t.change_amount > 0
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                            }`}
                          title="Gérer le retour monnaie"
                        >
                          <DollarSign className="w-3 h-3" />
                          {t.change_amount && t.change_amount > 0
                            ? `Retour: ${new Intl.NumberFormat('fr-FR').format(t.change_amount)}`
                            : 'Retour Monnaie'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div className="pt-2 text-center">
                <button
                  onClick={() => (window.location.hash = '#/transactions')}
                  className="text-xs text-primary hover:underline font-medium"
                >
                  Voir toutes les transactions
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Disburse Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded-lg border border-border shadow-lg max-w-md w-full">
            <h2 className="text-xl font-semibold mb-4">Décaisser</h2>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Demandeur</p>
                <p className="font-medium">{selectedRequest.requester.full_name}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Montant</p>
                <p className="font-bold text-lg">
                  {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(
                    selectedRequest.amount
                  )}
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Description</p>
                <p>{selectedRequest.description}</p>
              </div>

              {maxOutflowLimit > 0 && (
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md">
                  <AlertCircle className="w-4 h-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">
                    Limite maximale: <strong>{maxOutflowLimit.toLocaleString('fr-FR')} FCFA</strong>
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Justificatif (Optionnel)</label>
                {selectedRequest.proof_document_url && (
                  <div className="mb-2 p-2 bg-blue-50/50 text-blue-700 rounded-md text-xs flex items-center justify-between border border-blue-100">
                    <span className="font-medium">Un justificatif a déjà été fourni par le demandeur.</span>
                    <a href={selectedRequest.proof_document_url} target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-800">Voir</a>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium"
                />
                {proofFile && (
                  <p className="text-xs text-muted-foreground">Sélectionné : {proofFile.name}</p>
                )}
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setSelectedRequest(null)}
                  disabled={!!processingId}
                  className="px-4 py-2 border border-border rounded-md hover:bg-secondary transition-colors disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  onClick={confirmDisburse}
                  disabled={!!processingId}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {processingId ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Traitement...
                    </>
                  ) : (
                    'Confirmer le Décaissement'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inflow Modal */}
      {isInflowModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded-lg border border-border shadow-lg max-w-md w-full">
            <h2 className="text-xl font-semibold mb-4">Ajouter une Entrée de Caisse</h2>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Montant (FCFA)</label>
                <input
                  type="number"
                  value={inflowAmount || ''}
                  onChange={(e) => setInflowAmount(Number(e.target.value))}
                  placeholder="Entrer le montant"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <textarea
                  value={inflowDescription}
                  onChange={(e) => setInflowDescription(e.target.value)}
                  placeholder="Entrer la description (optionnel)"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setIsInflowModalOpen(false)}
                  disabled={isProcessingInflow}
                  className="px-4 py-2 border border-border rounded-md hover:bg-secondary transition-colors disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleInflow}
                  disabled={isProcessingInflow || inflowAmount <= 0}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isProcessingInflow ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Traitement...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Ajouter l&apos;Entrée
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
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

      {/* Voucher Modal */}
      {voucherData && <CashVoucher data={voucherData} onClose={() => setVoucherData(null)} />}
    </div>
  )
}
