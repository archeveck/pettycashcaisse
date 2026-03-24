import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { Loader2, Calendar, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'

interface Closure {
  id: string
  date: string
  opening_balance: number
  closing_balance: number
  closed_at: string
  closed_by: string
  cashier?: {
    full_name: string
  }
}

export default function ClosureHistory(): React.ReactElement {
  const [closures, setClosures] = useState<Closure[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    // Set default date range (last 30 days)
    const end = new Date()
    const start = new Date(new Date().getFullYear(), 0, 1)
    setStartDate(start.toISOString().split('T')[0])
    setEndDate(end.toISOString().split('T')[0])
  }, [])

  useEffect(() => {
    const fetchClosures = async (): Promise<void> => {
      setIsLoading(true)
      try {
        const { data, error } = await supabase
          .from('daily_closures')
          .select(
            `
          *,
          cashier:profiles!closed_by (
            full_name
          )
        `
          )
          .gte('date', startDate)
          .lte('date', endDate)
          .eq('status', 'closed')
          .order('date', { ascending: false })

        if (error) throw error
        setClosures(data as unknown as Closure[])
      } catch (err) {
        console.error('Error fetching closures:', err)
      } finally {
        setIsLoading(false)
      }
    }

    if (startDate && endDate) {
      fetchClosures()
    }
  }, [startDate, endDate])

  const fetchClosures = async (): Promise<void> => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('daily_closures')
        .select(
          `
          *,
          cashier:profiles!closed_by (
            full_name
          )
        `
        )
        .gte('date', startDate)
        .lte('date', endDate)
        .eq('status', 'closed')
        .order('date', { ascending: false })

      if (error) throw error
      setClosures(data as unknown as Closure[])
    } catch (err) {
      console.error('Error fetching closures:', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Historique des Clôtures</h1>

      {/* Date Range Filter */}
      <div className="flex gap-4 items-end">
        <div className="flex-1 space-y-2">
          <label className="text-sm font-medium">Date de Début</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="flex-1 space-y-2">
          <label className="text-sm font-medium">Date de Fin</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={fetchClosures}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          Appliquer
        </button>
      </div>

      {/* Closures List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : closures.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-lg border border-border">
          <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Aucune clôture trouvée pour la période sélectionnée.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {closures.map((closure, index) => {
            const previousClosure = closures[index + 1]
            const expectedOpening = previousClosure?.closing_balance || 0
            const openingDiscrepancy = closure.opening_balance - expectedOpening
            const hasOpeningDiscrepancy =
              Math.abs(openingDiscrepancy) > 0.01 && index < closures.length - 1

            // Calculate daily change
            const dailyChange = closure.closing_balance - closure.opening_balance

            return (
              <div
                key={closure.id}
                className="p-6 bg-card rounded-lg border border-border shadow-sm"
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">
                      {format(new Date(closure.date), 'EEEE, MMMM d, yyyy')}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Clôturé par {closure.cashier?.full_name || 'Inconnu'} à{' '}
                      {format(new Date(closure.closed_at), 'HH:mm')}
                    </p>
                  </div>
                  {hasOpeningDiscrepancy && (
                    <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-xs font-medium">Écart d&apos;Ouverture</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Solde d&apos;Ouverture</p>
                    <p className="font-semibold">
                      {new Intl.NumberFormat('fr-FR', {
                        style: 'currency',
                        currency: 'XOF'
                      }).format(closure.opening_balance)}
                    </p>
                    {hasOpeningDiscrepancy && (
                      <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                        {openingDiscrepancy > 0 ? '+' : ''}
                        {new Intl.NumberFormat('fr-FR', {
                          style: 'currency',
                          currency: 'XOF'
                        }).format(openingDiscrepancy)}
                      </p>
                    )}
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Solde de Clôture</p>
                    <p className="font-semibold">
                      {new Intl.NumberFormat('fr-FR', {
                        style: 'currency',
                        currency: 'XOF'
                      }).format(closure.closing_balance)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Variation Journalière</p>
                    <p
                      className={`font-semibold ${dailyChange > 0 ? 'text-green-600' : dailyChange < 0 ? 'text-red-600' : ''
                        }`}
                    >
                      {dailyChange > 0 ? '+' : ''}
                      {new Intl.NumberFormat('fr-FR', {
                        style: 'currency',
                        currency: 'XOF'
                      }).format(dailyChange)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Ouverture Attendue</p>
                    <p className="text-sm text-muted-foreground">
                      {index < closures.length - 1
                        ? new Intl.NumberFormat('fr-FR', {
                          style: 'currency',
                          currency: 'XOF'
                        }).format(expectedOpening)
                        : 'N/D'}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
