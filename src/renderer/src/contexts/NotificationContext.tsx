import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react'
import Toast, { NotificationType } from '../components/Toast'

interface Notification {
  id: string
  message: string
  type: NotificationType
}

interface NotificationContextType {
  showNotification: (message: string, type: NotificationType) => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function useNotification(): NotificationContextType {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider')
  }
  return context
}

interface NotificationProviderProps {
  children: ReactNode
}

export function NotificationProvider({ children }: NotificationProviderProps): React.ReactElement {
  const [notifications, setNotifications] = useState<Notification[]>([])

  useEffect(() => {
    if ('Notification' in window) {
      if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission()
      }
    }
  }, [])

  const showNotification = useCallback((message: string, type: NotificationType) => {
    const id = `${Date.now()}-${Math.random()}`
    setNotifications((prev) => [...prev, { id, message, type }])

    // Native Desktop Notification
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('Caisse Pettycash', {
          body: message,
          icon: '/favicon.ico', // Adjust icon path if needed
          requireInteraction: true, // Makes it persistent until user clicks/closes
          tag: id // Unique tag to avoid duplicates if many triggered fast
        })
      } catch (err) {
        console.error('Error showing native notification:', err)
      }
    }
  }, [])

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((notification) => notification.id !== id))
  }, [])

  return (
    <NotificationContext.Provider value={{ showNotification }}>
      {children}

      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-3">
        {notifications.map((notification) => (
          <Toast
            key={notification.id}
            id={notification.id}
            message={notification.message}
            type={notification.type}
            onClose={removeNotification}
          />
        ))}
      </div>
    </NotificationContext.Provider>
  )
}
