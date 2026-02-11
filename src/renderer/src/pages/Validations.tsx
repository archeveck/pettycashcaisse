import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useNotification } from '../contexts/NotificationContext'
import { supabase } from '../services/supabase'
import { Loader2, Check, X } from 'lucide-react'
import { format } from 'date-fns'
import { getErrorMessage } from '../utils/errorUtils'
import { RejectionModal } from '../components/RejectionModal'

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
    code: string
    name: string
    project: {
      name: string
    }
  }
}

export default function Validations(): React.ReactElement {
  const { profile } = useAuth()
  const { showNotification } = useNotification()
  const [requests, setRequests] = useState<CashRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false)
  const [requestToReject, setRequestToReject] = useState<string | null>(null)

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
    requester: profiles(
        full_name
    ),
        analytical_account: analytical_accounts(
            code,
            name,
            project: projects(
                name
            )
        )
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
  }, [fetchPendingRequests])

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

      const { error } = await supabase.from('cash_requests').update(updates).eq('id', id)

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

      const { error } = await supabase.from('cash_requests').update(updates).eq('id', requestToReject)

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
                <div className="flex items-center gap-2 text-sm">
                  <span className="bg-secondary px-2 py-1 rounded text-secondary-foreground">
                    {request.analytical_account.project.name} / {request.analytical_account.code}
                  </span>
                </div>
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
      )}

      <RejectionModal
        isOpen={isRejectModalOpen}
        onClose={() => {
          setIsRejectModalOpen(false)
          setRequestToReject(null)
        }}
        onConfirm={handleRejectConfirm}
        isProcessing={!!processingId && processingId === requestToReject}
      />
    </div>
  )
}
