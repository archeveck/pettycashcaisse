import { useState, useEffect } from 'react'
import { Wifi, WifiOff, Loader2 } from 'lucide-react'

export default function ConnectionIndicator(): React.ReactElement {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [isChecking, setIsChecking] = useState(false)

  useEffect(() => {
    const handleOnline = (): void => {
      setIsOnline(true)
      setIsChecking(false)
    }

    const handleOffline = (): void => {
      setIsOnline(false)
      setIsChecking(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (isChecking) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full text-xs">
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>Vérification...</span>
      </div>
    )
  }

  if (!isOnline) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-xs">
        <WifiOff className="w-3 h-3" />
        <span>Hors ligne</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs">
      <Wifi className="w-3 h-3" />
      <span>En ligne</span>
    </div>
  )
}
