import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../services/supabase'
import { useNotification } from '../contexts/NotificationContext'
import { getErrorMessage } from '../utils/errorUtils'
import {
  getAccountingAccounts,
  getProjects,
  getAnalyticalAccounts,
  type AccountingAccount,
  type Project,
  type AnalyticalAccount
} from '../services/settingsService'
import { SearchableSelect } from '../components/SearchableSelect'
import { Loader2, CheckCircle2, Search, Filter, Calendar, X } from 'lucide-react'
import { format, isWithinInterval, startOfDay, endOfDay, parseISO } from 'date-fns'
import * as XLSX from 'xlsx'

interface Transaction {
  id: string
  type: 'inflow' | 'outflow'
  amount: number
  description: string
  date: string
  accounting_account_id: string | null
  creator: {
    full_name: string
  }
  request?: {
    id: string
    requester: {
      full_name: string
    }
    supplier?: {
      name: string
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

export default function AccountantDashboard(): React.ReactElement {
  const { showNotification } = useNotification()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accountingAccounts, setAccountingAccounts] = useState<AccountingAccount[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [analyticalAccounts, setAnalyticalAccounts] = useState<AnalyticalAccount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [selectedAnalyticalAccountId, setSelectedAnalyticalAccountId] = useState<string>('')
  const [selectedStartDate, setSelectedStartDate] = useState<string>(
    new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]
  )
  const [selectedEndDate, setSelectedEndDate] = useState<string>('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const fetchData = useCallback(async (): Promise<void> => {
    setIsLoading(true)
    try {
      // 1. Fetch All Required Data
      const [accData, projData, analData] = await Promise.all([
        getAccountingAccounts(),
        getProjects(),
        getAnalyticalAccounts()
      ])

      setAccountingAccounts(accData.filter((a) => a.active))
      setProjects(projData.filter((p) => p.active))
      setAnalyticalAccounts(analData.filter((a) => a.active))

      // 2. Fetch All Transactions (Inflows and Outflows)
      const { data, error } = await supabase
        .from('cash_transactions')
        .select(
          `
          id,
          type,
          amount,
          description,
          date,
          accounting_account_id,
          creator:profiles!created_by (
            full_name
          ),
          request:cash_requests (
            id,
            status,
            requester:profiles (
              full_name
            ),
            supplier:suppliers (
              name
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
        .order('date', { ascending: false })

      if (error) throw error
      setTransactions(data as unknown as Transaction[])
    } catch (err: unknown) {
      console.error('Error fetching accountant data:', err)
      showNotification(`Erreur: ${getErrorMessage(err)}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }, [showNotification])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleUpdateAccountingAccount = async (
    transactionId: string,
    accountId: string
  ): Promise<void> => {
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

      setTransactions((prev) =>
        prev.map((t) =>
          t.id === transactionId ? { ...t, accounting_account_id: accountId || null } : t
        )
      )
      showNotification('Compte comptable mis à jour', 'success')
    } catch (err: unknown) {
      console.error('Error updating accounting account:', err)
      showNotification(`Erreur: ${getErrorMessage(err)}`, 'error')
    } finally {
      setUpdatingId(null)
    }
  }

  const filteredTransactions = transactions.filter((t) => {
    // Search term filter
    const matchesSearch =
      t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.request?.requester.full_name || t.creator.full_name)
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      (t.analytical_account?.code || '').toLowerCase().includes(searchTerm.toLowerCase())

    // Project filter
    const matchesProject =
      !selectedProjectId ||
      (t.analytical_account &&
        t.analytical_account.project.name ===
        projects.find((p) => p.id === selectedProjectId)?.name)

    // Analytical account filter
    const matchesAnalyticalId =
      !selectedAnalyticalAccountId ||
      (t.analytical_account &&
        analyticalAccounts.find((a) => a.id === selectedAnalyticalAccountId)?.code ===
        t.analytical_account.code)

    // Date Range filter
    let matchesDate = true
    if (selectedStartDate || selectedEndDate) {
      const tDate = parseISO(t.date)
      const start = selectedStartDate ? startOfDay(parseISO(selectedStartDate)) : null
      const end = selectedEndDate ? endOfDay(parseISO(selectedEndDate)) : null

      if (start && end) {
        matchesDate = isWithinInterval(tDate, { start, end })
      } else if (start) {
        matchesDate = tDate >= start
      } else if (end) {
        matchesDate = tDate <= end
      }
    }

    return matchesSearch && matchesProject && matchesAnalyticalId && matchesDate
  })

  const exportToExcel = (): void => {
    setIsExporting(true)
    try {
      const sortedTransactions = [...filteredTransactions].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      )

      const worksheetData = sortedTransactions.map((t) => {
        const acc = accountingAccounts.find((a) => a.id === t.accounting_account_id)
        return {
          Date: format(new Date(t.date), 'dd/MM/yyyy'),
          Libellé: t.description,
          'Compte Comptable': acc ? `${acc.code} - ${acc.name}` : '',
          Débit: t.type === 'inflow' ? t.amount : 0,
          Crédit: t.type === 'outflow' ? t.amount : 0,
          Solde: 0,
          'Compte Projet': t.analytical_account?.project.name || 'N/A',
          'Compte Analytique': t.analytical_account
            ? `${t.analytical_account.code} - ${t.analytical_account.name}`
            : 'N/A',
          Fournisseurs:
            t.request?.supplier?.name || t.request?.requester.full_name || t.creator.full_name
        }
      })

      // Calculate simple cumulative balance
      let runningBalance = 0
      worksheetData.forEach((row) => {
        runningBalance += (row['Débit'] as number) - (row['Crédit'] as number)
        row['Solde'] = runningBalance
      })

      const worksheet = XLSX.utils.json_to_sheet(worksheetData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions')

      // Custom column widths
      const wscols = [
        { wch: 12 }, // Date
        { wch: 30 }, // Libellé
        { wch: 30 }, // Compte Comptable
        { wch: 12 }, // Débit
        { wch: 12 }, // Crédit
        { wch: 12 }, // Solde
        { wch: 20 }, // Compte Projet
        { wch: 30 }, // Compte Analytique
        { wch: 20 } // Fournisseurs
      ]
      worksheet['!cols'] = wscols

      XLSX.writeFile(workbook, `Export_Caisse_${format(new Date(), 'yyyy-MM-dd_HHmm')}.xlsx`)
      showNotification('Export réussi', 'success')
    } catch (err: unknown) {
      console.error('Export error:', err)
      showNotification(`Erreur lors de l'export: ${getErrorMessage(err)}`, 'error')
    } finally {
      setIsExporting(false)
    }
  }

  const filteredAnalyticalOptions = analyticalAccounts.filter(
    (a) => !selectedProjectId || a.project_id === selectedProjectId
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Comptabilité</h1>
          <p className="text-muted-foreground">
            Associer les transactions décaissées aux comptes comptables
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportToExcel}
            disabled={isExporting || filteredTransactions.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Calendar className="w-4 h-4" />
            )}
            Exporter Excel
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md border transition-colors ${showFilters ||
              selectedProjectId ||
              selectedAnalyticalAccountId ||
              selectedStartDate ||
              selectedEndDate
              ? 'bg-primary/10 border-primary text-primary'
              : 'border-border hover:bg-muted'
              }`}
          >
            <Filter className="w-4 h-4" />
            Filtres
            {(selectedProjectId ||
              selectedAnalyticalAccountId ||
              selectedStartDate ||
              selectedEndDate) && <span className="flex h-2 w-2 rounded-full bg-primary" />}
          </button>
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
      </div>

      {showFilters && (
        <div className="p-4 bg-muted/30 rounded-lg border border-border grid grid-cols-1 md:grid-cols-4 gap-4 animate-in slide-in-from-top-2 duration-200">
          <div className="space-y-1.5 col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="w-3 h-3" />
                Date de début
              </label>
              <input
                type="date"
                value={selectedStartDate}
                onChange={(e) => setSelectedStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="w-3 h-3" />
                Date de fin
              </label>
              <input
                type="date"
                value={selectedEndDate}
                onChange={(e) => setSelectedEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Projet
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => {
                setSelectedProjectId(e.target.value)
                setSelectedAnalyticalAccountId('')
              }}
              className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Tous les projets</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Compte Analytique
            </label>
            <select
              value={selectedAnalyticalAccountId}
              onChange={(e) => setSelectedAnalyticalAccountId(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Tous les comptes</option>
              {filteredAnalyticalOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} - {a.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setSelectedProjectId('')
                setSelectedAnalyticalAccountId('')
                setSelectedStartDate('')
                setSelectedEndDate('')
                setSearchTerm('')
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
              Réinitialiser
            </button>
          </div>
        </div>
      )}

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
                    {t.request?.requester.full_name || t.creator.full_name}
                    {t.type === 'inflow' && (
                      <span className="ml-2 text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold uppercase">
                        Entrant
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4">{t.description}</td>
                  <td
                    className={`px-4 py-4 font-bold ${t.type === 'inflow' ? 'text-green-600' : ''}`}
                  >
                    {t.type === 'inflow' ? '+' : '-'}{' '}
                    {new Intl.NumberFormat('fr-FR', {
                      style: 'currency',
                      currency: 'XOF'
                    }).format(t.amount)}
                  </td>
                  <td className="px-4 py-4">
                    {t.analytical_account ? (
                      <>
                        <span className="text-xs bg-secondary px-2 py-1 rounded">
                          {t.analytical_account.code}
                        </span>
                        <p className="text-[10px] text-muted-foreground mt-1 truncate max-w-[150px]">
                          {t.analytical_account.name}
                        </p>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">N/A</span>
                    )}
                  </td>
                  <td className="px-4 py-4 min-w-[250px]">
                    <div className="flex items-center gap-2">
                      <SearchableSelect
                        options={accountingAccounts}
                        value={t.accounting_account_id || ''}
                        onChange={(value) => handleUpdateAccountingAccount(t.id, value)}
                        disabled={updatingId === t.id}
                        placeholder="Rechercher un compte..."
                        className="min-h-10 text-xs"
                      />
                      {updatingId === t.id && (
                        <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                      )}
                      {t.accounting_account_id && updatingId !== t.id && (
                        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
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
