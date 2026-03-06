import React from 'react'
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { NotificationProvider } from './contexts/NotificationContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import MainLayout from './layouts/MainLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import NewRequest from './pages/NewRequest'
import MyRequests from './pages/MyRequests'
import Validations from './pages/Validations'
import CashierDashboard from './pages/CashierDashboard'
import DailyClosure from './pages/DailyClosure'
import ClosureHistory from './pages/ClosureHistory'
import Transactions from './pages/Transactions'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import AccountantDashboard from './pages/AccountantDashboard'
import Unauthorized from './pages/Unauthorized'
import NotificationTest from './pages/NotificationTest'
import { UpdateNotification } from './components/UpdateNotification'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { isSupabaseConfigured } from './services/supabase'
import { AlertTriangle } from 'lucide-react'

const queryClient = new QueryClient()

function App(): React.ReactElement {
  if (!isSupabaseConfigured) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
    const partialUrl = supabaseUrl ? `...${supabaseUrl.slice(-4)}` : 'vide'

    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-gray-50 p-8 text-center">
        <AlertTriangle className="h-16 w-16 text-amber-500" />
        <h1 className="text-2xl font-bold text-gray-900">Erreur de Configuration</h1>
        <p className="max-w-md text-gray-600">
          Les variables d&apos;environnement Supabase sont manquantes dans ce build.
          Vérifiez vos <strong>Secrets GitHub</strong> et assurez-vous de pousser un <strong>nouveau tag</strong> (ex: v1.0.9) après les avoir ajoutés.
        </p>
        <div className="mt-4 rounded-md bg-white p-4 text-left font-mono text-sm shadow-sm">
          <p className="font-semibold">Diagnostic :</p>
          <ul className="mt-2 space-y-1">
            <li>VITE_SUPABASE_URL : {partialUrl}</li>
            <li>VITE_SUPABASE_ANON_KEY : {import.meta.env.VITE_SUPABASE_ANON_KEY ? 'configurée' : 'vide'}</li>
          </ul>
        </div>
      </div>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NotificationProvider>
          <Router>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/unauthorized" element={<Unauthorized />} />

              {/* Protected Routes */}
              <Route element={<ProtectedRoute />}>
                <Route element={<MainLayout />}>
                  <Route path="/" element={<Dashboard />} />

                  <Route path="/requests/new" element={<NewRequest />} />
                  <Route path="/requests" element={<MyRequests />} />

                  <Route element={<ProtectedRoute allowedRoles={['controller', 'cfo']} />}>
                    <Route path="/validations" element={<Validations />} />
                  </Route>

                  <Route element={<ProtectedRoute allowedRoles={['cashier']} />}>
                    <Route path="/cashier" element={<CashierDashboard />} />
                    <Route path="/cashier/closure" element={<DailyClosure />} />
                    <Route path="/cashier/history" element={<ClosureHistory />} />
                  </Route>

                  <Route
                    element={
                      <ProtectedRoute
                        allowedRoles={['cashier', 'controller', 'cfo', 'requester']}
                      />
                    }
                  >
                    <Route path="/transactions" element={<Transactions />} />
                  </Route>

                  <Route element={<ProtectedRoute allowedRoles={['admin', 'controller', 'cfo']} />}>
                    <Route path="/reports" element={<Reports />} />
                  </Route>

                  <Route element={<ProtectedRoute allowedRoles={['admin', 'accountant']} />}>
                    <Route path="/accounting" element={<AccountantDashboard />} />
                  </Route>

                  <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                    <Route path="/settings" element={<Settings />} />
                  </Route>

                  {/* Notification Test Page - accessible to all authenticated users */}
                  <Route path="/notification-test" element={<NotificationTest />} />
                </Route>
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <UpdateNotification />
          </Router>
        </NotificationProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
