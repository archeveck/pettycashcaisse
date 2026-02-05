import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

interface DesktopNotificationOptions {
  title: string
  body: string
  icon?: string
  onClick?: () => void
}

export function useDesktopNotifications(): {
  showDesktopNotification: (options: DesktopNotificationOptions) => void
} {
  const navigate = useNavigate()

  // Request permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  const showDesktopNotification = (options: DesktopNotificationOptions): void => {
    console.log('[useDesktopNotifications] Attempting to show notification:', options.title)
      
    // Check if notifications are supported and permitted
    if (!('Notification' in window)) {
      console.warn('[useDesktopNotifications] Desktop notifications not supported')
      return
    }

    console.log('[useDesktopNotifications] Notification permission:', Notification.permission)

    if (Notification.permission !== 'granted') {
      console.warn(
        '[useDesktopNotifications] Notification permission not granted. Current:',
        Notification.permission
      )
      // Try to request permission if not denied
      if (Notification.permission === 'default') {
        Notification.requestPermission().then((permission) => {
          console.log('[useDesktopNotifications] Permission request result:', permission)
          if (permission === 'granted') {
            // Retry showing notification
            showDesktopNotification(options)
          }
        })
      }
      return
    }

    try {
      console.log('[useDesktopNotifications] Creating notification...')
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon || '/icon.png',
        badge: '/icon.png',
        tag: 'validation-request', // Prevents duplicate notifications
        requireInteraction: false
      })

      console.log('[useDesktopNotifications] Notification created successfully')

      // Handle click
      notification.onclick = () => {
        console.log('[useDesktopNotifications] Notification clicked')
        window.focus()
        if (options.onClick) {
          options.onClick()
        } else {
          navigate('/validations')
        }
        notification.close()
      }

      // Auto-close after 10 seconds
      setTimeout(() => {
        notification.close()
      }, 10000)
    } catch (error) {
      console.error('[useDesktopNotifications] Error showing desktop notification:', error)
    }
  }

  return { showDesktopNotification }
}
