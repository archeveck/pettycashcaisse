import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../services/supabase'
import { Loader2, Plus, Printer } from 'lucide-react'
import CashVoucher from '../components/CashVoucher'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'

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

interface VoucherData {
  transactionId: string
  date: string
  requesterName: string
  amount: number
  description: string
  analyticalAccount: {
    code: string
    name: string
    project: {
      name: string
    }
  }
  cashierName?: string
}

export default function MyRequests(): React.ReactElement {
  const { user, profile } = useAuth()
  const [requests, setRequests] = useState<CashRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [voucherData, setVoucherData] = useState<VoucherData | null>(null)

  useEffect(() => {
    const fetchRequests = async (): Promise<void> => {
      if (!user) return

      try {
        let query = supabase
          .from('cash_requests')
          .select(
            `
            id,
            amount,
            description,
            status,
            created_at,
            requester:profiles(full_name),
            analytical_account:analytical_accounts (
              code,
              name,
              project:projects (
                name
              )
            )
          `
          )
          .order('created_at', { ascending: false })

        // Apply filter only for requesters
        if (profile?.role === 'requester') {
          query = query.eq('requester_id', user.id)
        }

        const { data, error } = await query

        if (error) throw error
        setRequests(data as unknown as CashRequest[])
      } catch (err) {
        console.error('Error fetching requests:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchRequests()
  }, [user])

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'approved':
        return 'text-green-600 bg-green-100'
      case 'rejected':
        return 'text-red-600 bg-red-100'
      case 'disbursed':
        return 'text-blue-600 bg-blue-100'
      default:
        return 'text-yellow-600 bg-yellow-100'
    }
  }

  const handlePrintVoucher = async (request: CashRequest): Promise<void> => {
    try {
      // Fetch transaction data for this request
      const { data: transaction, error } = await supabase
        .from('cash_transactions')
        .select('id, date')
        .eq('request_id', request.id)
        .single()

      if (error) throw error

      setVoucherData({
        transactionId: transaction.id,
        date: transaction.date,
        requesterName: request.requester?.full_name || 'N/A',
        amount: request.amount,
        description: request.description,
        analyticalAccount: request.analytical_account
      })
    } catch (err) {
      console.error('Error fetching transaction:', err)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">
          {profile?.role === 'requester' ? 'Mes Demandes' : 'Toutes les Demandes'}
        </h1>
        {profile?.role === 'requester' && (
          <Link
            to="/requests/new"
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-md hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nouvelle Demande
          </Link>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-lg border border-border">
          <p className="text-muted-foreground">Aucune demande trouvée.</p>
        </div>
      ) : (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-secondary/50 border-b border-border">
                <tr>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Demandeur</th>
                  <th className="px-6 py-3">Description</th>
                  <th className="px-6 py-3">Compte</th>
                  <th className="px-6 py-3">Montant</th>
                  <th className="px-6 py-3">Statut</th>
                  <th className="px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr
                    key={request.id}
                    className="bg-card border-b border-border hover:bg-muted/50 transition-colors"
                  >
                    <td className="px-6 py-4 font-medium">
                      {format(new Date(request.created_at), 'MMM d, yyyy')}
                    </td>
                    <td className="px-6 py-4 font-medium text-purple-600">
                      {request.requester?.full_name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 max-w-xs truncate" title={request.description}>
                      {request.description}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-medium">{request.analytical_account.code}</span>
                        <span className="text-xs text-muted-foreground">
                          {request.analytical_account.project.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-bold">
                      {new Intl.NumberFormat('fr-FR', {
                        style: 'currency',
                        currency: 'XOF'
                      }).format(request.amount)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}
                      >
                        {request.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {request.status === 'disbursed' && (
                        <button
                          onClick={() => handlePrintVoucher(request)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-primary/10 text-primary hover:bg-primary/20 rounded-md transition-colors"
                          title="Imprimer la pièce de caisse"
                        >
                          <Printer className="w-4 h-4" />
                          Imprimer
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Voucher Modal */}
      {voucherData && (
        <CashVoucher data={voucherData} onClose={() => setVoucherData(null)} />
      )}
    </div>
  )
}
