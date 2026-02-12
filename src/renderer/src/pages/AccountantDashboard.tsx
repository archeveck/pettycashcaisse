import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { useAuth } from '../hooks/useAuth'
import { useNotification } from '../contexts/NotificationContext'
import { getErrorMessage } from '../utils/errorUtils'
import { getAccountingAccounts, type AccountingAccount } from '../services/settingsService'
import { Loader2, CheckCircle2, Search } from 'lucide-react'
import { format } from 'date-fns'

interface Transaction {
    id: string
    type: 'inflow' | 'outflow'
    amount: number
    description: string
    date: string
    accounting_account_id: string | null
    request: {
        id: string
        requester: {
            full_name: string
        }
    }
    analytical_account: {
        code: string
        name: string
        project: {
            name: string
        }
    }
}

export default function AccountantDashboard(): React.ReactElement {
    const { profile } = useAuth()
    const { showNotification } = useNotification()
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [accountingAccounts, setAccountingAccounts] = useState<AccountingAccount[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [updatingId, setUpdatingId] = useState<string | null>(null)

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async (): Promise<void> => {
        setIsLoading(true)
        try {
            // 1. Fetch Accounting Accounts
            const accData = await getAccountingAccounts()
            setAccountingAccounts(accData.filter(a => a.active))

            // 2. Fetch Disbursed Transactions
            const { data, error } = await supabase
                .from('cash_transactions')
                .select(`
          id,
          type,
          amount,
          description,
          date,
          accounting_account_id,
          request:cash_requests!inner (
            id,
            status,
            requester:profiles (
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
        `)
                .eq('type', 'outflow')
                .eq('request.status', 'disbursed')
                .order('date', { ascending: false })

            if (error) throw error
            setTransactions(data as unknown as Transaction[])
        } catch (err: unknown) {
            console.error('Error fetching accountant data:', err)
            showNotification(`Erreur: ${getErrorMessage(err)}`, 'error')
        } finally {
            setIsLoading(false)
        }
    }

    const handleUpdateAccountingAccount = async (transactionId: string, accountId: string): Promise<void> => {
        setUpdatingId(transactionId)
        try {
            const { error } = await supabase
                .from('cash_transactions')
                .update({
                    accounting_account_id: accountId || null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', transactionId)

            if (error) throw error

            setTransactions(prev => prev.map(t =>
                t.id === transactionId ? { ...t, accounting_account_id: accountId || null } : t
            ))
            showNotification('Compte comptable mis à jour', 'success')
        } catch (err: unknown) {
            console.error('Error updating accounting account:', err)
            showNotification(`Erreur: ${getErrorMessage(err)}`, 'error')
        } finally {
            setUpdatingId(null)
        }
    }

    const filteredTransactions = transactions.filter(t =>
        t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.request.requester.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.analytical_account.code.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Comptabilité</h1>
                    <p className="text-muted-foreground">Associer les transactions décaissées aux comptes comptables</p>
                </div>
                <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Rechercher..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            ) : filteredTransactions.length === 0 ? (
                <div className="p-12 text-center bg-card rounded-lg border border-dashed border-border text-muted-foreground">
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>Aucune transaction décaissée trouvée.</p>
                </div>
            ) : (
                <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-muted text-left border-b border-border">
                                <th className="px-4 py-3 font-semibold">Date</th>
                                <th className="px-4 py-3 font-semibold">Bénéficiaire</th>
                                <th className="px-4 py-3 font-semibold">Description</th>
                                <th className="px-4 py-3 font-semibold">Montant</th>
                                <th className="px-4 py-3 font-semibold">Compte Analytique</th>
                                <th className="px-4 py-3 font-semibold w-64">Compte Comptable</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {filteredTransactions.map((t) => (
                                <tr key={t.id} className="hover:bg-muted/50 transition-colors">
                                    <td className="px-4 py-4 whitespace-nowrap text-muted-foreground">
                                        {format(new Date(t.date), 'dd/MM/yyyy')}
                                    </td>
                                    <td className="px-4 py-4 font-medium">
                                        {t.request.requester.full_name}
                                    </td>
                                    <td className="px-4 py-4">
                                        {t.description}
                                    </td>
                                    <td className="px-4 py-4 font-bold">
                                        {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(t.amount)}
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className="text-xs bg-secondary px-2 py-1 rounded">
                                            {t.analytical_account.code}
                                        </span>
                                        <p className="text-[10px] text-muted-foreground mt-1 truncate max-w-[150px]">
                                            {t.analytical_account.name}
                                        </p>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-2">
                                            <select
                                                value={t.accounting_account_id || ''}
                                                onChange={(e) => handleUpdateAccountingAccount(t.id, e.target.value)}
                                                disabled={updatingId === t.id}
                                                className="w-full px-2 py-1 bg-background border border-input rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                                            >
                                                <option value="">Sélectionner un compte...</option>
                                                {accountingAccounts.map(acc => (
                                                    <option key={acc.id} value={acc.id}>
                                                        {acc.code} - {acc.name}
                                                    </option>
                                                ))}
                                            </select>
                                            {updatingId === t.id && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                                            {t.accounting_account_id && updatingId !== t.id && (
                                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
