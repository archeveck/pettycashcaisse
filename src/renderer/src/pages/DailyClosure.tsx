import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../services/supabase'
import { Loader2, Lock, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getErrorMessage } from '../utils/errorUtils'

interface TransactionSummary {
  totalInflows: number
  totalOutflows: number
}

export default function DailyClosure(): React.ReactElement {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [openingBalance, setOpeningBalance] = useState(0)
  const [closingBalance, setClosingBalance] = useState(0)
  const [notes, setNotes] = useState('')
  const [transactionSummary, setTransactionSummary] = useState<TransactionSummary | null>(null)
  const [alreadyClosed, setAlreadyClosed] = useState(false)

  useEffect(() => {
    fetchTodayData()
  }, [])

  const fetchTodayData = async (): Promise<void> => {
    setIsLoading(true)
    try {
      const today = new Date().toISOString().split('T')[0]

      // Check if already closed today
      const { data: existingClosure } = await supabase
        .from('daily_closures')
        .select('*')
        .eq('date', today)
        .eq('status', 'closed')
        .single()

      if (existingClosure) {
        setAlreadyClosed(true)
        setOpeningBalance(existingClosure.opening_balance)
        setClosingBalance(existingClosure.closing_balance || 0)
        setIsLoading(false)
        return
      }

      // Get yesterday's closing balance as today's opening balance
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayDate = yesterday.toISOString().split('T')[0]

      const { data: yesterdayClosure } = await supabase
        .from('daily_closures')
        .select('closing_balance')
        .eq('date', yesterdayDate)
        .eq('status', 'closed')
        .single()

      const calculatedOpeningBalance = yesterdayClosure?.closing_balance || 0
      setOpeningBalance(calculatedOpeningBalance)

      // Get today's transactions
      const { data: transactions, error: transError } = await supabase
        .from('cash_transactions')
        .select('type, amount, date')
        .gte('date', `${today}T00:00:00`)
        .lte('date', `${today}T23:59:59`)

      if (transError) throw transError

      // Calculate totals
      const summary = transactions?.reduce(
        (acc, trans) => {
          if (trans.type === 'inflow') {
            acc.totalInflows += trans.amount
          } else {
            acc.totalOutflows += trans.amount
          }
          return acc
        },
        { totalInflows: 0, totalOutflows: 0 }
      ) || { totalInflows: 0, totalOutflows: 0 }

      setTransactionSummary(summary)
    } catch (err) {
      console.error('Error fetching closure data:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClosure = async (): Promise<void> => {
    if (!profile) return
    setIsSaving(true)

    try {
      const today = new Date().toISOString().split('T')[0]

      const { error } = await supabase.from('daily_closures').insert({
        date: today,
        opening_balance: openingBalance,
        closing_balance: closingBalance,
        closed_by: profile.id,
        closed_at: new Date().toISOString(),
        status: 'closed'
      })

      if (error) throw error

      alert('Clôture journalière effectuée avec succès.')
      navigate('/cashier')
    } catch (err: unknown) {
      console.error('Closure error:', err)
      alert(`Échec de la clôture de la caisse : ${getErrorMessage(err)}`)
    } finally {
      setIsSaving(false)
    }
  }

  const expectedClosingBalance = transactionSummary
    ? openingBalance + transactionSummary.totalInflows - transactionSummary.totalOutflows
    : openingBalance

  const discrepancy = closingBalance - expectedClosingBalance
  const hasDiscrepancy = Math.abs(discrepancy) > 0.01
  const discrepancyThreshold = 1000 // XOF - configurable threshold

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (alreadyClosed) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Clôture Journalière</h1>
        <div className="p-6 bg-card rounded-lg border border-border shadow-sm">
          <div className="flex items-center gap-3 text-green-600 mb-4">
            <Lock className="w-6 h-6" />
            <h2 className="text-xl font-semibold">Caisse Déjà Clôturée</h2>
          </div>
          <p className="text-muted-foreground mb-4">
            La caisse a déjà été clôturée pour aujourd&apos;hui.
          </p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Solde d&apos;Ouverture :</span>
              <span className="font-medium">
                {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(
                  openingBalance
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Solde de Clôture :</span>
              <span className="font-medium">
                {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(
                  closingBalance
                )}
              </span>
            </div>
          </div>
          <button
            onClick={() => navigate('/cashier')}
            className="mt-6 w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Retour à la Caisse
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Clôture Journalière</h1>

      {/* Transaction Summary */}
      {transactionSummary && (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="p-4 bg-card rounded-lg border border-border shadow-sm">
            <p className="text-sm text-muted-foreground mb-1">Solde d&apos;Ouverture</p>
            <p className="text-xl font-bold">
              {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(
                openingBalance
              )}
            </p>
          </div>
          <div className="p-4 bg-card rounded-lg border border-border shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <p className="text-sm text-muted-foreground">Total Entrées</p>
            </div>
            <p className="text-xl font-bold text-green-600">
              {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(
                transactionSummary.totalInflows
              )}
            </p>
          </div>
          <div className="p-4 bg-card rounded-lg border border-border shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-4 h-4 text-red-600" />
              <p className="text-sm text-muted-foreground">Total Sorties</p>
            </div>
            <p className="text-xl font-bold text-red-600">
              {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(
                transactionSummary.totalOutflows
              )}
            </p>
          </div>
        </div>
      )}

      {/* Expected Balance */}
      <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900">
        <p className="text-sm text-blue-700 dark:text-blue-300 mb-1">Solde de Clôture Attendu</p>
        <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
          {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(
            expectedClosingBalance
          )}
        </p>
        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
          Ouverture + Entrées - Sorties
        </p>
      </div>

      {/* Closure Form */}
      <div className="p-6 bg-card rounded-lg border border-border shadow-sm space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Solde de Clôture Réel (Comptage Physique)</label>
          <input
            type="number"
            value={closingBalance}
            onChange={(e) => setClosingBalance(Number(e.target.value))}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Entrer le comptage physique de la caisse"
          />
        </div>

        {/* Discrepancy Warning */}
        {hasDiscrepancy && closingBalance > 0 && (
          <div
            className={`p-4 rounded-lg border ${
              Math.abs(discrepancy) > discrepancyThreshold
                ? 'bg-destructive/10 border-destructive/30'
                : 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900'
            }`}
          >
            <div className="flex items-start gap-3">
              <AlertTriangle
                className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                  Math.abs(discrepancy) > discrepancyThreshold
                    ? 'text-destructive'
                    : 'text-yellow-600 dark:text-yellow-400'
                }`}
              />
              <div className="flex-1">
                <h3
                  className={`font-semibold mb-1 ${
                    Math.abs(discrepancy) > discrepancyThreshold
                      ? 'text-destructive'
                      : 'text-yellow-700 dark:text-yellow-300'
                  }`}
                >
                  {Math.abs(discrepancy) > discrepancyThreshold
                    ? 'Écart Important Détecté !'
                    : 'Écart Détecté'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {discrepancy > 0 ? 'Excédent' : 'Manque'} de{' '}
                  <span className="font-bold">
                    {new Intl.NumberFormat('fr-FR', {
                      style: 'currency',
                      currency: 'XOF'
                    }).format(Math.abs(discrepancy))}
                  </span>
                </p>
                {Math.abs(discrepancy) > discrepancyThreshold && (
                  <p className="text-sm mt-2 text-destructive">
                    Veuillez vérifier votre comptage physique et enquêter sur l&apos;écart avant de
                    clôturer.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium">Notes (Optionnel)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Ajouter des notes sur les écarts ou problèmes..."
          />
        </div>

        <button
          onClick={handleClosure}
          disabled={
            isSaving || (Math.abs(discrepancy) > discrepancyThreshold && closingBalance > 0)
          }
          className="w-full flex items-center justify-center px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Lock className="w-4 h-4 mr-2" />
          )}
          {Math.abs(discrepancy) > discrepancyThreshold && closingBalance > 0
            ? 'Impossible de Clôturer - Écart Important'
            : 'Clôturer la Caisse'}
        </button>

        {Math.abs(discrepancy) > discrepancyThreshold && closingBalance > 0 && (
          <p className="text-xs text-center text-muted-foreground">
            L&apos;écart dépasse le seuil de{' '}
            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(
              discrepancyThreshold
            )}
          </p>
        )}
      </div>
    </div>
  )
}
