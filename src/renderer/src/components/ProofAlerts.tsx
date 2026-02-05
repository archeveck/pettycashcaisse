import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { AlertTriangle } from 'lucide-react'
import { differenceInDays } from 'date-fns'

interface LateProofTransaction {
  id: string
  amount: number
  description: string
  date: string
  created_by: string
  requester?: {
    full_name: string
  }
}

interface ProofAlertsProps {
  daysThreshold?: number // Number of days before considering proof late
}

export default function ProofAlerts({
  daysThreshold = 3
}: ProofAlertsProps): React.ReactElement | null {
  const [lateTransactions, setLateTransactions] = useState<LateProofTransaction[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchLateProofs = async (): Promise<void> => {
      try {
        const thresholdDate = new Date()
        thresholdDate.setDate(thresholdDate.getDate() - daysThreshold)

        const { data, error } = await supabase
          .from('cash_transactions')
          .select(
            `
          id,
          amount,
          description,
          date,
          created_by,
          requester:profiles!created_by (
            full_name
          )
        `
          )
          .eq('type', 'outflow')
          .is('proof_submitted_at', null)
          .lt('date', thresholdDate.toISOString())
          .order('date', { ascending: true })

        if (error) throw error
        setLateTransactions(data as unknown as LateProofTransaction[])
      } catch (err) {
        console.error('Error fetching late proofs:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchLateProofs()
  }, [daysThreshold])

  if (isLoading) return null

  if (lateTransactions.length === 0) return null

  return (
    <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-destructive mb-2">
            Soumissions de Justificatifs en Retard ({lateTransactions.length})
          </h3>
          <p className="text-sm text-muted-foreground mb-3">
            Les transactions suivantes n&apos;ont pas de justificatifs :
          </p>
          <div className="space-y-2">
            {lateTransactions.slice(0, 5).map((trans) => {
              const daysLate = differenceInDays(new Date(), new Date(trans.date))
              return (
                <div
                  key={trans.id}
                  className="text-sm p-2 bg-background rounded border border-border"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">
                        {trans.requester?.full_name || 'Inconnu'} -{' '}
                        {new Intl.NumberFormat('fr-FR', {
                          style: 'currency',
                          currency: 'XOF'
                        }).format(trans.amount)}
                      </p>
                      <p className="text-xs text-muted-foreground">{trans.description}</p>
                    </div>
                    <span className="text-xs text-destructive font-medium">
                      {daysLate} jour{daysLate > 1 ? 's' : ''} de retard
                    </span>
                  </div>
                </div>
              )
            })}
            {lateTransactions.length > 5 && (
              <p className="text-xs text-muted-foreground text-center pt-2">
                Et {lateTransactions.length - 5} de plus...
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
