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

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient()

function App(): React.ReactElement {
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
                </Route>
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Router>
        </NotificationProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
