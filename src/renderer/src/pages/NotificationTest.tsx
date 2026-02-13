import { useDesktopNotifications } from '../hooks/useDesktopNotifications'

export default function NotificationTest(): React.ReactElement {
  const { showDesktopNotification } = useDesktopNotifications()

  const testNotification = (): void => {
    console.log('[NotificationTest] Testing notification...')
    showDesktopNotification({
      title: 'Test de Notification',
      body: 'Ceci est une notification de test pour vérifier que le système fonctionne correctement.',
      onClick: () => {
        console.log('[NotificationTest] Notification clicked!')
        alert('Notification cliquée !')
      }
    })
  }

  const testValidationNotification = (): void => {
    console.log('[NotificationTest] Testing validation notification...')
    showDesktopNotification({
      title: 'Nouvelle demande de validation',
      body: 'Demande de Jean Dupont - 50 000 FCFA',
      onClick: () => {
        console.log('[NotificationTest] Validation notification clicked!')
      }
    })
  }

  const checkPermission = (): void => {
    if ('Notification' in window) {
      console.log('[NotificationTest] Notification permission:', Notification.permission)
      alert(`Permission actuelle: ${Notification.permission}`)
    } else {
      alert('Les notifications ne sont pas supportées dans ce navigateur')
    }
  }

  const requestPermission = async (): Promise<void> => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission()
      console.log('[NotificationTest] Permission request result:', permission)
      alert(`Résultat de la demande: ${permission}`)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
          Test des Notifications
        </h1>
        <p className="text-muted-foreground mt-2">
          Utilisez cette page pour tester le système de notifications de l'application
        </p>
      </div>

      <div className="p-8 bg-card/50 backdrop-blur-sm rounded-2xl border border-border/50 shadow-lg space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            Vérification des Autorisations
          </h2>
          <div className="flex gap-4">
            <button
              onClick={checkPermission}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95 font-semibold"
            >
              Vérifier les Autorisations
            </button>
            <button
              onClick={requestPermission}
              className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95 font-semibold"
            >
              Demander les Autorisations
            </button>
          </div>
        </div>

        <div className="border-t border-border/50 pt-6">
          <h2 className="text-2xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            Test des Notifications
          </h2>
          <div className="flex gap-4">
            <button
              onClick={testNotification}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95 font-semibold"
            >
              Notification Simple
            </button>
            <button
              onClick={testValidationNotification}
              className="px-6 py-3 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95 font-semibold"
            >
              Notification de Validation
            </button>
          </div>
        </div>

        <div className="border-t border-border/50 pt-6">
          <h2 className="text-2xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            Instructions
          </h2>
          <div className="space-y-3 text-sm">
            <div className="p-4 bg-blue-600/10 border border-blue-600/20 rounded-xl">
              <p className="font-semibold text-blue-600 mb-2">1. Vérifier les autorisations</p>
              <p className="text-muted-foreground">
                Cliquez sur "Vérifier les Autorisations" pour voir l'état actuel des permissions de
                notification.
              </p>
            </div>
            <div className="p-4 bg-green-600/10 border border-green-600/20 rounded-xl">
              <p className="font-semibold text-green-600 mb-2">2. Demander les autorisations</p>
              <p className="text-muted-foreground">
                Si les autorisations ne sont pas accordées, cliquez sur "Demander les Autorisations"
                pour les obtenir.
              </p>
            </div>
            <div className="p-4 bg-purple-600/10 border border-purple-600/20 rounded-xl">
              <p className="font-semibold text-purple-600 mb-2">3. Tester les notifications</p>
              <p className="text-muted-foreground">
                Une fois les autorisations accordées, testez les notifications en cliquant sur les
                boutons de test.
              </p>
            </div>
            <div className="p-4 bg-orange-600/10 border border-orange-600/20 rounded-xl">
              <p className="font-semibold text-orange-600 mb-2">4. Vérifier les logs</p>
              <p className="text-muted-foreground">
                Ouvrez la console développeur (F12) pour voir les logs détaillés du système de
                notifications.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
