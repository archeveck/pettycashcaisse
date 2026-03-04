import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { supabase } from '../services/supabase'
import { Loader2, Wallet, Eye, EyeOff } from 'lucide-react'
import { getErrorMessage } from '../utils/errorUtils'

const loginSchema = z.object({
  email: z.string().email('Adresse email invalide'),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères')
})

type LoginFormValues = z.infer<typeof loginSchema>

export default function Login(): React.ReactElement {
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/'
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema)
  })

  const onSubmit = async (data: LoginFormValues): Promise<void> => {
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password
      })

      if (error) throw error

      navigate(from, { replace: true })
    } catch (err: unknown) {
      console.error('Login error:', err)
      setError(`Erreur de connexion: ${getErrorMessage(err)} `)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen animated-gradient relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-purple-500/30 rounded-full blur-3xl animate-pulse"></div>
      <div
        className="absolute bottom-0 right-0 w-96 h-96 bg-blue-500/30 rounded-full blur-3xl animate-pulse"
        style={{ animationDelay: '1s' }}
      ></div>

      <div className="w-full max-w-md p-8 space-y-6 glass rounded-2xl shadow-2xl border border-white/20 backdrop-blur-xl relative z-10 hover-lift">
        <div className="text-center space-y-3">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl shadow-lg">
              <Wallet className="w-12 h-12 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            Caisse Petite Monnaie
          </h1>
          <p className="text-muted-foreground text-sm">Connectez-vous pour gérer votre caisse</p>
        </div>

        {error && (
          <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-lg border border-destructive/20 animate-in fade-in slide-in-from-top-2 duration-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground" htmlFor="email">
              Adresse Email
            </label>
            <input
              id="email"
              type="email"
              className="flex h-12 w-full rounded-xl border border-input bg-background/50 backdrop-blur-sm px-4 py-3 text-sm ring-offset-background transition-all duration-200 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50 hover:border-primary/50"
              placeholder="name@example.com"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-sm text-destructive animate-in fade-in slide-in-from-top-1 duration-200">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className="flex h-12 w-full rounded-xl border border-input bg-background/50 backdrop-blur-sm px-4 py-3 text-sm ring-offset-background transition-all duration-200 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50 hover:border-primary/50 pr-12"
                placeholder="••••••••"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-sm text-destructive animate-in fade-in slide-in-from-top-1 duration-200">
                {errors.password.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex items-center justify-center w-full h-12 px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl hover:from-purple-700 hover:to-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Connexion en cours...
              </>
            ) : (
              'Se Connecter'
            )}
          </button>
        </form>

        <div className="pt-4 text-center">
          <p className="text-xs text-muted-foreground">Système sécurisé de gestion de caisse</p>
        </div>
      </div>
    </div>
  )
}
