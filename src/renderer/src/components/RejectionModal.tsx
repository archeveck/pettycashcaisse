import React, { useState } from 'react'
import { X, AlertCircle } from 'lucide-react'

interface RejectionModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
  isProcessing: boolean
}

export const RejectionModal: React.FC<RejectionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isProcessing
}) => {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    if (!reason.trim()) {
      setError('Le motif de rejet est requis')
      return
    }
    onConfirm(reason)
    setReason('')
    setError('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-background w-full max-w-md rounded-lg shadow-lg border border-border p-6 animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2 text-destructive">
            <AlertCircle className="w-5 h-5" />
            Rejeter la demande
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="reason" className="block text-sm font-medium mb-1.5">
                Motif du rejet
              </label>
              <textarea
                id="reason"
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value)
                  if (error) setError('')
                }}
                className="w-full min-h-[100px] p-3 rounded-md border border-input bg-transparent text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="Veuillez expliquer pourquoi cette demande est rejetée..."
                autoFocus
              />
              {error && <p className="text-sm text-destructive mt-1">{error}</p>}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isProcessing}
                className="px-4 py-2 text-sm font-medium rounded-md hover:bg-secondary transition-colors disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isProcessing || !reason.trim()}
                className="px-4 py-2 text-sm font-medium bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isProcessing ? 'Traitement...' : 'Confirmer le rejet'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
