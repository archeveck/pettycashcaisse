import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import {
  Loader2,
  Download,
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle
} from 'lucide-react'
import { format } from 'date-fns'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'

interface Transaction {
  id: string
  amount: number
  type: 'inflow' | 'outflow'
  date: string
  description: string
  proof_submitted_at: string | null
  analytical_account?: {
    code: string
    name: string
    project_id?: string
    project: {
      name: string
    }
  }
}

interface Project {
  id: string
  name: string
  code: string
}

interface AnalyticalAccount {
  id: string
  name: string
  code: string
  project_id: string
}

export default function Reports(): React.ReactElement {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [accounts, setAccounts] = useState<AnalyticalAccount[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Filters
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedProject, setSelectedProject] = useState('')
  const [selectedAccount, setSelectedAccount] = useState('')
  const [selectedType, setSelectedType] = useState<'all' | 'inflow' | 'outflow'>('all')

  useEffect(() => {
    // Set default date range (last 30 days)
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 30)
    setStartDate(start.toISOString().split('T')[0])
    setEndDate(end.toISOString().split('T')[0])

    fetchProjects()
    fetchAccounts()
  }, [])

  useEffect(() => {
    if (startDate && endDate) {
      fetchTransactions()
    }
  }, [startDate, endDate, selectedProject, selectedAccount, selectedType])

  const fetchProjects = async (): Promise<void> => {
    const { data } = await supabase.from('projects').select('*').eq('active', true)
    if (data) setProjects(data)
  }

  const fetchAccounts = async (): Promise<void> => {
    const { data } = await supabase.from('analytical_accounts').select('*')
    if (data) setAccounts(data)
  }

  const fetchTransactions = async (): Promise<void> => {
    setIsLoading(true)
    try {
      let query = supabase
        .from('cash_transactions')
        .select(
          `
          *,
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

      if (selectedType !== 'all') {
        query = query.eq('type', selectedType)
      }

      if (selectedAccount) {
        query = query.eq('analytical_account_id', selectedAccount)
      }

      const { data, error } = await query

      if (error) throw error

      let filtered = data as Transaction[]

      // Filter by project if selected
      if (selectedProject) {
        filtered = filtered.filter(
          (t) =>
            t.analytical_account?.project && t.analytical_account.project_id === selectedProject
        )
      }

      setTransactions(filtered || [])
    } catch (err) {
      console.error('Error fetching transactions:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Calculate summary statistics
  const totalInflows = transactions
    .filter((t) => t.type === 'inflow')
    .reduce((sum, t) => sum + t.amount, 0)

  const totalOutflows = transactions
    .filter((t) => t.type === 'outflow')
    .reduce((sum, t) => sum + t.amount, 0)

  const netBalance = totalInflows - totalOutflows

  const lateProofs = transactions.filter(
    (t) => t.type === 'outflow' && !t.proof_submitted_at
  ).length

  // Prepare chart data
  const chartData = transactions.reduce(
    (acc: Record<string, { date: string; inflow: number; outflow: number }>, curr) => {
      const date = format(new Date(curr.date), 'MMM d')
      if (!acc[date]) acc[date] = { date, inflow: 0, outflow: 0 }
      if (curr.type === 'inflow') acc[date].inflow += curr.amount
      else acc[date].outflow += curr.amount
      return acc
    },
    {}
  )

  const chartDataArray = Object.values(chartData).reverse()

  // Export to CSV
  const exportToCSV = (): void => {
    const headers = [
      'Date',
      'Type',
      'Montant',
      'Description',
      'Compte',
      'Projet',
      'Statut Justificatif'
    ]
    const rows = transactions.map((t) => [
      format(new Date(t.date), 'yyyy-MM-dd HH:mm'),
      t.type === 'inflow' ? 'Entrée' : 'Sortie',
      t.amount,
      t.description,
      t.analytical_account?.code || 'N/A',
      t.analytical_account?.project?.name || 'N/A',
      t.proof_submitted_at ? 'Soumis' : 'Manquant'
    ])

    const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `transactions_${startDate}_to_${endDate}.csv`
    link.click()
  }

  const filteredAccounts = selectedProject
    ? accounts.filter((a) => a.project_id === selectedProject)
    : accounts

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Rapports</h1>
        <button
          onClick={exportToCSV}
          disabled={transactions.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          Exporter CSV
        </button>
      </div>

      {/* Filters */}
      <div className="p-4 bg-card rounded-lg border border-border shadow-sm">
        <h3 className="font-semibold mb-3">Filtres</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as 'all' | 'inflow' | 'outflow')}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="all">Tous</option>
              <option value="inflow">Entrée</option>
              <option value="outflow">Sortie</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Projet</label>
            <select
              value={selectedProject}
              onChange={(e) => {
                setSelectedProject(e.target.value)
                setSelectedAccount('') // Reset account when project changes
              }}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Tous les Projets</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Compte</label>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Tous les Comptes</option>
              {filteredAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} - {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
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
            <DollarSign className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-medium text-muted-foreground">Solde Net</h3>
          </div>
          <p className={`text-2xl font-bold ${netBalance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(
              netBalance
            )}
          </p>
        </div>

        <div className="p-6 bg-card rounded-lg border border-border shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            <h3 className="text-sm font-medium text-muted-foreground">Justificatifs en Retard</h3>
          </div>
          <p className="text-2xl font-bold text-yellow-600">{lateProofs}</p>
        </div>
      </div>

      {/* Chart */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="p-6 bg-card rounded-lg border border-border shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Tendance des Flux de Trésorerie</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartDataArray}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="inflow" fill="#16a34a" name="Entrée" />
                <Bar dataKey="outflow" fill="#dc2626" name="Sortie" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Transactions Table */}
      <div className="p-6 bg-card rounded-lg border border-border shadow-sm">
        <h3 className="text-lg font-semibold mb-4">Transactions ({transactions.length})</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr className="text-left">
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium">Type</th>
                <th className="pb-2 font-medium">Montant</th>
                <th className="pb-2 font-medium">Description</th>
                <th className="pb-2 font-medium">Compte</th>
                <th className="pb-2 font-medium">Justificatif</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    Aucune transaction trouvée pour les filtres sélectionnés.
                  </td>
                </tr>
              ) : (
                transactions.map((t) => (
                  <tr key={t.id} className="border-b border-border">
                    <td className="py-3">{format(new Date(t.date), 'MMM d, HH:mm')}</td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          t.type === 'inflow'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}
                      >
                        {t.type}
                      </span>
                    </td>
                    <td className="py-3 font-medium">
                      {new Intl.NumberFormat('fr-FR', {
                        style: 'currency',
                        currency: 'XOF'
                      }).format(t.amount)}
                    </td>
                    <td className="py-3">{t.description}</td>
                    <td className="py-3 text-xs">
                      {t.analytical_account ? (
                        <>
                          <div>{t.analytical_account.code}</div>
                          <div className="text-muted-foreground">
                            {t.analytical_account.project?.name}
                          </div>
                        </>
                      ) : (
                        'N/D'
                      )}
                    </td>
                    <td className="py-3">
                      {t.type === 'outflow' && (
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            t.proof_submitted_at
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                          }`}
                        >
                          {t.proof_submitted_at ? '✓ Soumis' : '⚠ Manquant'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
