import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useNotification } from '../contexts/NotificationContext'
import { supabase } from '../services/supabase'
import { Loader2, Check, X, ExternalLink } from 'lucide-react'
import { format } from 'date-fns'
import { getErrorMessage } from '../utils/errorUtils'
import { RejectionModal } from '../components/RejectionModal'
import { SearchableSelect } from '../components/SearchableSelect'
import { Edit2, RotateCcw } from 'lucide-react'
import {
  getAnalyticalAccounts,
  AnalyticalAccount,
  getProjects,
  Project,
  getSuppliers,
  Supplier
} from '../services/settingsService'

interface CashRequest {
  id: string
  amount: number
  description: string
  status: string
  created_at: string
  requester: {
    full_name: string
  }
  analytical_account: {
    id: string
    code: string
    name: string
    project: {
      id: string
      name: string
    }
  }
  supplier?: {
    id: string
    name: string
  } | null
  proof_document_url?: string | null
}

export default function Validations(): React.ReactElement {
  const { profile } = useAuth()
  const { showNotification } = useNotification()
  const [requests, setRequests] = useState<CashRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false)
  const [requestToReject, setRequestToReject] = useState<string | null>(null)

  // Edit mode state
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null)
  const [modifiedAccountId, setModifiedAccountId] = useState<string | null>(null)
  const [modifiedProjectId, setModifiedProjectId] = useState<string | null>(null)
  const [allAccounts, setAllAccounts] = useState<AnalyticalAccount[]>([])
  const [allProjects, setAllProjects] = useState<Project[]>([])
  const [allSuppliers, setAllSuppliers] = useState<Supplier[]>([])
  const [modifiedSupplierId, setModifiedSupplierId] = useState<string | null>(null)

  const fetchPendingRequests = useCallback(async (): Promise<void> => {
    if (!profile) return

    let targetStatus = ''
    if (profile.role === 'controller') targetStatus = 'pending_controller'
    if (profile.role === 'cfo') targetStatus = 'pending_cfo'

    if (!targetStatus) return

    try {
      const { data, error } = await supabase
        .from('cash_requests')
        .select(
          `
id,
    amount,
    description,
    status,
    created_at,
    proof_document_url,
    requester: profiles(
        full_name
    ),
        analytical_account: analytical_accounts(
            id,
            code,
            name,
            project: projects(
                id,
                name
            )
        ),
        supplier: suppliers(id, name)
            `
        )
        .eq('status', targetStatus)
        .order('created_at', { ascending: true })

      if (error) throw error
      setRequests(data as unknown as CashRequest[])
    } catch (err) {
      console.error('Error fetching validations:', err)
    } finally {
      setIsLoading(false)
    }
  }, [profile])

  useEffect(() => {
    fetchPendingRequests()
    loadAccounts()
  }, [fetchPendingRequests])

  const loadAccounts = async (): Promise<void> => {
    try {
      const [accounts, projects, suppliers] = await Promise.all([getAnalyticalAccounts(), getProjects(), getSuppliers()])
      setAllAccounts(accounts)
      setAllProjects(projects)
      setAllSuppliers(suppliers)
    } catch (err) {
      console.error('Error loading accounts, projects and suppliers:', err)
    }
  }

  const handleAction = async (id: string, action: 'approve' | 'reject'): Promise<void> => {
    if (!profile) return
    setProcessingId(id)

    try {
      let updates: Record<string, unknown> = {}

      if (action === 'reject') {
        setRequestToReject(id)
        setIsRejectModalOpen(true)
        setProcessingId(null)
        return
      } else {
        // Approve
        if (profile.role === 'controller') {
          updates = {
            status: 'approved',
            controller_approval_at: new Date().toISOString()
          }
        } else if (profile.role === 'cfo') {
          updates = {
            status: 'approved',
            cfo_approval_at: new Date().toISOString()
          }
        }
      }

      // Include modified analytical account if changed
      if (editingRequestId === id && modifiedAccountId) {
        updates.analytical_account_id = modifiedAccountId
      }

      // Include modified supplier if changed
      if (editingRequestId === id && modifiedSupplierId !== undefined) {
        updates.supplier_id = modifiedSupplierId
      }

      const { error } = await supabase.from('cash_requests').update(updates).eq('id', id)

      if (error) throw error

      // Send Email Notification
      supabase.functions
        .invoke('send-email', {
          body: {
            type: 'validation',
            requestId: id,
            action: action // 'approve' or 'reject'
          }
        })
        .catch((err) => console.error('Failed to send email notification:', err))

      if (error) throw error

      // Show success notification
      if (action === 'approve') {
        showNotification('Demande approuvée avec succès !', 'success')
      } else {
        showNotification('Demande rejetée', 'info')
      }

      // Remove from list
      setRequests((prev) => prev.filter((r) => r.id !== id))
    } catch (err: unknown) {
      showNotification('Erreur lors du traitement de la demande : ' + getErrorMessage(err), 'error')
    } finally {
      setProcessingId(null)
    }
  }

  const handleRejectConfirm = async (reason: string): Promise<void> => {
    if (!requestToReject || !profile) return

    setProcessingId(requestToReject)

    try {
      const updates = {
        status: 'rejected',
        rejection_reason: reason
      }

      const { error } = await supabase
        .from('cash_requests')
        .update(updates)
        .eq('id', requestToReject)

      if (error) throw error

      // Send Email Notification
      supabase.functions
        .invoke('send-email', {
          body: {
            type: 'validation',
            requestId: requestToReject,
            action: 'reject'
          }
        })
        .catch((err) => console.error('Failed to send email notification:', err))

      if (error) throw error

      showNotification('Demande rejetée', 'info')
      setRequests((prev) => prev.filter((r) => r.id !== requestToReject))
      setIsRejectModalOpen(false)
      setRequestToReject(null)
    } catch (err: unknown) {
      showNotification('Erreur lors du traitement de la demande : ' + getErrorMessage(err), 'error')
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Validations en Attente</h1>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-lg border border-border">
          <p className="text-muted-foreground">Aucune demande en attente de votre validation.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {requests.map((request) => (
            <div
              key={request.id}
              className="p-6 bg-card rounded-lg border border-border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-lg">{request.requester.full_name}</span>
                  <span className="text-sm text-muted-foreground">
                    • {format(new Date(request.created_at), 'MMM d, HH:mm')}
                  </span>
                </div>
                <p className="text-muted-foreground">{request.description}</p>
                <div className="flex flex-col gap-2">
                  {request.supplier && (
                    <div className="flex items-center gap-2 text-sm text-purple-600 font-medium">
                      <span>Fournisseur: {request.supplier.name}</span>
                    </div>
                  )}
                  {editingRequestId === request.id ? (
                    <div className="flex flex-col gap-3 p-3 bg-secondary/30 rounded-lg">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-muted-foreground uppercase">
                            Modifier Projet
                          </label>
                          <SearchableSelect
                            options={allProjects.map((p) => ({
                              id: p.id,
                              name: p.name
                            }))}
                            value={modifiedProjectId || request.analytical_account.project.id}
                            onChange={(val) => {
                              setModifiedProjectId(val)
                              setModifiedAccountId(null) // Reset account when project changes
                            }}
                            placeholder="Rechercher un projet..."
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-muted-foreground uppercase">
                            Modifier Compte Analytique
                          </label>
                          <SearchableSelect
                            options={allAccounts
                              .filter((acc) => {
                                const projectId = modifiedProjectId || request.analytical_account.project.id
                                return acc.project_id === projectId
                              })
                              .map((acc) => ({
                                id: acc.id,
                                name: `${acc.code} - ${acc.name}`
                              }))}
                            value={modifiedAccountId || request.analytical_account.id}
                            onChange={(val) => setModifiedAccountId(val)}
                            placeholder="Rechercher un compte..."
                            disabled={!modifiedProjectId && !request.analytical_account.project.id}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-muted-foreground uppercase">
                            Modifier Fournisseur
                          </label>
                          <SearchableSelect
                            options={allSuppliers.map((s) => ({
                              id: s.id,
                              name: s.name
                            }))}
                            value={modifiedSupplierId !== null ? modifiedSupplierId : (request.supplier?.id || '')}
                            onChange={(val) => setModifiedSupplierId(val)}
                            placeholder="Rechercher un fournisseur..."
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingRequestId(null)
                            setModifiedAccountId(null)
                            setModifiedProjectId(null)
                            setModifiedSupplierId(null)
                          }}
                          className="text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground"
                        >
                          <RotateCcw className="w-3 h-3" /> Annuler
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm group">
                      <span className="bg-secondary px-2 py-1 rounded text-secondary-foreground">
                        {request.analytical_account.project.name} / {request.analytical_account.code}
                      </span>
                      {profile?.role === 'controller' && (
                        <button
                          onClick={() => {
                            setEditingRequestId(request.id)
                            setModifiedAccountId(request.analytical_account.id)
                            setModifiedProjectId(request.analytical_account.project.id)
                            setModifiedSupplierId(request.supplier?.id || null)
                          }}
                          className="p-1 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-all"
                          title="Modifier le compte"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {request.proof_document_url && (
                  <div className="mt-2">
                    <a
                      href={request.proof_document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Voir le justificatif du demandeur
                    </a>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-2xl font-bold">
                    {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(
                      request.amount
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Montant</p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleAction(request.id, 'approve')}
                    disabled={!!processingId}
                    className="p-2 bg-green-100 text-green-700 rounded-full hover:bg-green-200 disabled:opacity-50 transition-colors"
                    title="Approuver"
                  >
                    {processingId === request.id ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Check className="w-5 h-5" />
                    )}
                  </button>
                  <button
                    onClick={() => handleAction(request.id, 'reject')}
                    disabled={!!processingId}
                    className="p-2 bg-red-100 text-red-700 rounded-full hover:bg-red-200 disabled:opacity-50 transition-colors"
                    title="Rejeter"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )
      }

      <RejectionModal
        isOpen={isRejectModalOpen}
        onClose={() => {
          setIsRejectModalOpen(false)
          setRequestToReject(null)
        }}
        onConfirm={handleRejectConfirm}
        isProcessing={!!processingId && processingId === requestToReject}
      />
    </div >
  )
}
