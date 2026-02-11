import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import ConnectionIndicator from '../components/ConnectionIndicator'
import {
  LayoutDashboard,
  FileText,
  Wallet,
  Settings,
  LogOut,
  CheckSquare,
  PieChart,
  List
} from 'lucide-react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: (string | undefined | null | false)[]): string {
  return twMerge(clsx(inputs))
}

export default function MainLayout(): React.ReactElement {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async (): Promise<void> => {
    await signOut()
    navigate('/login')
  }

  const navItems = [
    {
      label: 'Tableau de Bord',
      path: '/',
      icon: LayoutDashboard,
      roles: ['admin', 'controller', 'cfo', 'cashier', 'requester']
    },
    {
      label: 'Nouvelle Demande',
      path: '/requests/new',
      icon: FileText,
      roles: ['requester']
    },
    {
      label: profile?.role === 'requester' ? 'Mes Demandes' : 'Toutes les Demandes',
      path: '/requests',
      icon: FileText,
      roles: ['requester', 'cfo', 'admin']
    },
    {
      label: 'Validations',
      path: '/validations',
      icon: CheckSquare,
      roles: ['controller']
    },
    {
      label: 'Transactions',
      path: '/transactions',
      icon: List,
      roles: ['cashier', 'controller', 'cfo', 'requester']
    },
    {
      label: 'Caisse',
      path: '/cashier',
      icon: Wallet,
      roles: ['cashier']
    },
    {
      label: 'Rapports',
      path: '/reports',
      icon: PieChart,
      roles: ['admin', 'controller', 'cfo']
    },
    {
      label: 'Paramètres',
      path: '/settings',
      icon: Settings,
      roles: ['admin']
    }
  ]

  const filteredNavItems = navItems.filter((item) => profile && item.roles.includes(profile.role))

  return (
    <div className="flex h-screen bg-gradient-to-br from-background via-background to-secondary/30">
      {/* Sidebar */}
      <aside className="w-72 border-r border-border/50 bg-card/80 backdrop-blur-xl flex flex-col shadow-xl">
        <div className="p-6 border-b border-border/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl shadow-lg">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                Caisse Petite Monnaie
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-purple-600/10 to-blue-600/10 rounded-lg border border-purple-600/20">
            <div className="w-2 h-2 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full animate-pulse"></div>
            <p className="text-xs font-semibold text-foreground capitalize">{profile?.role}</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {filteredNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group relative overflow-hidden',
                  isActive
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg shadow-purple-600/25'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                )
              }
            >
              {({ isActive }) => (
                <>
                  {!isActive && (
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 to-blue-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-xl"></div>
                  )}
                  <item.icon
                    className={cn(
                      'w-5 h-5 relative z-10 transition-transform duration-200',
                      !isActive && 'group-hover:scale-110'
                    )}
                  />
                  <span className="relative z-10">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-border/50 space-y-3 bg-gradient-to-b from-transparent to-secondary/20">
          <ConnectionIndicator />
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-all duration-200 group hover:shadow-md"
          >
            <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="container mx-auto p-8 max-w-7xl">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
