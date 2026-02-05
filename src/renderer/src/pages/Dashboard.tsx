import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useDesktopNotifications } from '../hooks/useDesktopNotifications'
import { supabase } from '../services/supabase'
import ProofAlerts from '../components/ProofAlerts'
import {
  Loader2,
  DollarSign,
  FileText,
  AlertTriangle,
  Plus,
  CheckCircle,
  List,
  TrendingUp
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface DashboardStats {
  currentBalance: number
  pendingRequests: number
  myPendingRequests: number
  lateProofs: number
  approvedRequests: number
}

interface QuickAction {
  label: string
  icon: React.ComponentType<{ className?: string }>
  onClick: () => void
  gradient: string
}

export default function Dashboard(): React.ReactElement {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { showDesktopNotification } = useDesktopNotifications()
  const [stats, setStats] = useState<DashboardStats>({
    currentBalance: 0,
    pendingRequests: 0,
    myPendingRequests: 0,
    lateProofs: 0,
    approvedRequests: 0
  })
  const [isLoading, setIsLoading] = useState(true)

  const showProofAlerts =
    profile?.role && ['admin', 'controller', 'cashier'].includes(profile.role)

  useEffect(() => {
    const fetchStats = async (): Promise<void> => {
      if (!profile) return

      try {
        // Get current balance
        const { data: transactions } = await supabase
          .from('cash_transactions')
          .select('type, amount')

        const balance =
          transactions?.reduce((acc, t) => {
            return t.type === 'inflow' ? acc + t.amount : acc - t.amount
          }, 0) || 0

        // Get pending requests count for validators
        let pendingCount = 0
        if (profile.role === 'controller') {
          const { count } = await supabase
            .from('cash_requests')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending_controller')
          pendingCount = count || 0
        }

        // Get my pending requests for requesters
        let myPendingCount = 0
        if (profile.role === 'requester') {
          const { count } = await supabase
            .from('cash_requests')
            .select('*', { count: 'exact', head: true })
            .eq('requester_id', profile.id)
            .in('status', ['pending_controller'])
          myPendingCount = count || 0
        }

        // Get late proofs count
        const thresholdDate = new Date()
        thresholdDate.setDate(thresholdDate.getDate() - 3)
        const { count: lateProofsCount } = await supabase
          .from('cash_transactions')
          .select('*', { count: 'exact', head: true })
          .eq('type', 'outflow')
          .is('proof_submitted_at', null)
          .lt('date', thresholdDate.toISOString())

        // Get approved requests count
        let approvedCount = 0
        if (profile.role === 'requester') {
          const { count } = await supabase
            .from('cash_requests')
            .select('*', { count: 'exact', head: true })
            .eq('requester_id', profile.id)
            .eq('status', 'approved')
          approvedCount = count || 0
        } else if (['cashier', 'admin', 'controller'].includes(profile.role)) {
          const { count } = await supabase
            .from('cash_requests')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'approved')
          approvedCount = count || 0
        }

        setStats({
          currentBalance: balance,
          pendingRequests: pendingCount,
          myPendingRequests: myPendingCount,
          lateProofs: lateProofsCount || 0,
          approvedRequests: approvedCount
        })
      } catch (error) {
        console.error('Error fetching stats:', error)
      } finally {
        setIsLoading(false)
      }
    }

    if (!profile) {
      return
    }

    fetchStats()

    // Set up real-time subscription for cash_requests updates
    const requestsSubscription = supabase
      .channel('dashboard-requests')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cash_requests'
        },
        () => {
          fetchStats()
        }
      )
      .subscribe()

    // Set up real-time subscription for cash_transactions updates
    const transactionsSubscription = supabase
      .channel('dashboard-transactions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cash_transactions'
        },
        () => {
          fetchStats()
        }
      )
      .subscribe()

    // Cleanup subscriptions on unmount
    return () => {
      requestsSubscription.unsubscribe()
      transactionsSubscription.unsubscribe()
    }
  }, [profile])

  // Desktop notifications for validation requests
  useEffect(() => {
    if (!profile || !['controller'].includes(profile.role)) {
      console.log('[Desktop Notifications] User role not eligible:', profile?.role)
      return
    }

    const targetStatus = 'pending_controller'
    console.log('[Desktop Notifications] Setting up subscription for role:', profile.role, 'status:', targetStatus)

    // Check notification permission
    if ('Notification' in window) {
      console.log('[Desktop Notifications] Permission status:', Notification.permission)
    } else {
      console.warn('[Desktop Notifications] Notification API not supported')
    }

    // Subscribe to new validation requests (INSERT for new requests, UPDATE for status changes)
    const validationNotificationChannel = supabase
      .channel('validation-notifications')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT and UPDATE)
          schema: 'public',
          table: 'cash_requests'
          // No filter - we'll filter client-side to catch both new requests and status updates
        },
        async (payload) => {
          console.log('[Desktop Notifications] Raw event received:', payload.eventType, payload)

          // Type assertion for payload
          const newRecord = payload.new as { id: string; amount: number; status: string;[key: string]: unknown }

          // Client-side filter: only process if status matches our target
          if (newRecord.status !== targetStatus) {
            console.log('[Desktop Notifications] Ignoring event - status mismatch:', newRecord.status, 'vs', targetStatus)
            return
          }

          console.log('[Desktop Notifications] Event matches target status:', targetStatus)

          // Fetch requester details
          const { data: request, error } = await supabase
            .from('cash_requests')
            .select(`
              amount,
              requester:profiles(full_name)
            `)
            .eq('id', newRecord.id)
            .single()

          if (error) {
            console.error('[Desktop Notifications] Error fetching request details:', error)
            return
          }

          if (request && request.requester) {
            // Handle requester as array (Supabase returns it as array)
            const requesterData = Array.isArray(request.requester)
              ? request.requester[0]
              : request.requester
            const requesterName = (requesterData as { full_name: string })?.full_name || 'Un utilisateur'
            const amount = new Intl.NumberFormat('fr-FR').format(newRecord.amount)

            console.log('[Desktop Notifications] Showing notification for:', requesterName, amount)

            showDesktopNotification({
              title: 'Nouvelle demande de validation',
              body: `Demande de ${requesterName} - ${amount} FCFA`,
              onClick: () => navigate('/validations')
            })

            // Refresh stats to update the count
            // Trigger a manual refresh by updating a state
            setStats((prev) => ({ ...prev, pendingRequests: prev.pendingRequests + 1 }))
          } else {
            console.warn('[Desktop Notifications] No request data or requester found')
          }
        }
      )
      .subscribe((status) => {
        console.log('[Desktop Notifications] Subscription status:', status)
      })

    // Cleanup on unmount
    return () => {
      console.log('[Desktop Notifications] Cleaning up subscription')
      validationNotificationChannel.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]) // Only re-subscribe when profile changes

  const getQuickActions = (): QuickAction[] => {
    const actions: QuickAction[] = []

    if (profile?.role === 'requester' || profile?.role === 'admin') {
      actions.push({
        label: 'Nouvelle demande',
        icon: Plus,
        onClick: () => navigate('/requests/new'),
        gradient: 'from-blue-600 to-cyan-600'
      })
    }

    if (profile?.role === 'controller') {
      actions.push({
        label: 'Validations',
        icon: CheckCircle,
        onClick: () => navigate('/validations'),
        gradient: 'from-green-600 to-emerald-600'
      })
    }

    if (profile?.role === 'cashier') {
      actions.push({
        label: 'Caisse',
        icon: DollarSign,
        onClick: () => navigate('/cashier'),
        gradient: 'from-purple-600 to-pink-600'
      })
    }

    // Transactions for cashier, controller, cfo, requester
    if (
      profile?.role === 'cashier' ||
      profile?.role === 'controller' ||
      profile?.role === 'requester'
    ) {
      actions.push({
        label: 'Transactions',
        icon: List,
        onClick: () => navigate('/transactions'),
        gradient: 'from-indigo-600 to-purple-600'
      })
    }

    if (profile?.role === 'admin' || profile?.role === 'controller') {
      actions.push({
        label: 'Rapports',
        icon: FileText,
        onClick: () => navigate('/reports'),
        gradient: 'from-orange-600 to-red-600'
      })
    }

    return actions
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            Tableau de Bord
          </h1>
          <p className="text-muted-foreground mt-2">Bienvenue, {profile?.full_name}</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600/10 to-blue-600/10 rounded-xl border border-purple-600/20">
          <TrendingUp className="w-5 h-5 text-purple-600" />
          <span className="text-sm font-semibold capitalize">{profile?.role}</span>
        </div>
      </div>

      {/* Proof Alerts for relevant roles */}
      {showProofAlerts && <ProofAlerts daysThreshold={3} />}

      {/* Statistics Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Current Balance - for cashier, admin, controller, cfo */}
          {(profile?.role === 'cashier' ||
            profile?.role === 'admin' ||
            profile?.role === 'controller') && (
              <div className="group p-6 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                      <DollarSign className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-sm font-semibold text-white/90">Solde Actuel</h3>
                  </div>
                  <div className="text-3xl font-bold text-white">
                    {new Intl.NumberFormat('fr-FR', {
                      style: 'currency',
                      currency: 'XOF'
                    }).format(stats.currentBalance)}
                  </div>
                </div>
              </div>
            )}

          {/* Pending Validations - for controller, cfo */}
          {(profile?.role === 'controller') && (
            <div
              onClick={() => navigate('/validations')}
              className="group p-6 bg-gradient-to-br from-green-600 to-emerald-600 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 relative overflow-hidden cursor-pointer"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    <CheckCircle className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-sm font-semibold text-white/90">Validations en Attente</h3>
                </div>
                <div className="text-3xl font-bold text-white">{stats.pendingRequests}</div>
              </div>
            </div>
          )}

          {/* My Pending Requests - for requester */}
          {profile?.role === 'requester' && (
            <div
              onClick={() => navigate('/requests')}
              className="group p-6 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 relative overflow-hidden cursor-pointer"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    <FileText className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-sm font-semibold text-white/90">Mes Demandes en Attente</h3>
                </div>
                <div className="text-3xl font-bold text-white">{stats.myPendingRequests}</div>
              </div>
            </div>
          )}

          {/* Approved Requests - for cashier */}
          {profile?.role === 'cashier' && (
            <div
              onClick={() => navigate('/cashier')}
              className="group p-6 bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 relative overflow-hidden cursor-pointer"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    <CheckCircle className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-sm font-semibold text-white/90">Décaissement En Attente</h3>
                </div>
                <div className="text-3xl font-bold text-white">{stats.approvedRequests}</div>
              </div>
            </div>
          )}

          {/* Late Proofs - for all staff */}
          {showProofAlerts && (
            <div
              onClick={() => navigate('/transactions?filter=missing_proof')}
              className="group p-6 bg-gradient-to-br from-orange-600 to-red-600 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 relative overflow-hidden cursor-pointer"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    <AlertTriangle className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-sm font-semibold text-white/90">Justificatifs en Retard</h3>
                </div>
                <div className="text-3xl font-bold text-white">{stats.lateProofs}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick Actions */}
      <div className="p-8 bg-card/50 backdrop-blur-sm rounded-2xl border border-border/50 shadow-lg hover-lift">
        <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
          Actions Rapides
        </h2>
        <div className="flex flex-wrap gap-4">
          {getQuickActions().map((action, index) => (
            <button
              key={index}
              onClick={action.onClick}
              className={`group flex items-center gap-3 px-6 py-4 text-white rounded-xl bg-gradient-to-r ${action.gradient} shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95`}
            >
              <action.icon className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
              <span className="font-semibold">{action.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
