import { useState, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '../hooks/useAuth'
import { useNotification } from '../contexts/NotificationContext'
import { supabase } from '../services/supabase'
import {
  getAppSettings,
  getSuppliers,
  getProjects,
  type Supplier,
  type Project
} from '../services/settingsService'
import { getErrorMessage } from '../utils/errorUtils'
import { Loader2, Send, ArrowLeft, AlertCircle, Briefcase } from 'lucide-react'
import { SearchableSelect } from '../components/SearchableSelect'

// Schema factory for the request form (dynamic based on max limit)
const createRequestSchema = (
  maxLimit: number
): z.ZodObject<{
  amount: z.ZodNumber
  description: z.ZodString
  analytical_account_id: z.ZodString
  project_id: z.ZodString
  supplier_id: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<''>]>
}> =>
  z.object({
    amount: z
      .number()
      .min(1, 'Le montant doit être supérieur à 0')
      .max(maxLimit, `Le montant ne peut pas dépasser ${maxLimit.toLocaleString('fr-FR')} FCFA`),
    description: z.string().min(5, 'La description doit contenir au moins 5 caractères'),
    project_id: z.string().uuid('Veuillez sélectionner un projet'),
    analytical_account_id: z.string().uuid('Veuillez sélectionner un compte analytique'),
    supplier_id: z
      .string()
      .uuid('Veuillez sélectionner un fournisseur')
      .optional()
      .or(z.literal(''))
  })

type RequestFormValues = z.infer<ReturnType<typeof createRequestSchema>>

interface AnalyticalAccount {
  id: string
  project_id: string
  name: string
  code: string
  project: {
    name: string
    code: string
  }
}

// Type for Supabase response (project is returned as an array)
interface SupabaseAnalyticalAccount {
  id: string
  project_id: string
  name: string
  code: string
  project: {
    name: string
    code: string
  }[]
}

export default function NewRequest(): React.ReactElement {
  const { user } = useAuth()
  const { showNotification } = useNotification()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [accounts, setAccounts] = useState<AnalyticalAccount[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [fetchError] = useState<string | null>(null)
  const [maxOutflowLimit, setMaxOutflowLimit] = useState<number>(0)
  const [isLoadingSettings, setIsLoadingSettings] = useState(true)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors }
  } = useForm<RequestFormValues>({
    resolver: zodResolver(createRequestSchema(maxOutflowLimit || 999999999))
  })

  const selectedProjectId = watch('project_id')

  // Filter accounts based on selected project
  const filteredAccounts = accounts.filter((acc) => acc.project_id === selectedProjectId)

  // Reset analytical account when project changes
  useEffect(() => {
    setValue('analytical_account_id', '')
  }, [selectedProjectId, setValue])

  // Fetch app settings and analytical accounts on mount
  useEffect(() => {
    const fetchData = async (): Promise<void> => {
      try {
        // Fetch app settings
        const settings = await getAppSettings()
        setMaxOutflowLimit(settings.max_outflow_limit)
        setIsLoadingSettings(false)

        // Fetch analytical accounts
        const { data, error } = await supabase
          .from('analytical_accounts')
          .select(
            `
            id,
            project_id,
            name,
            code,
            project:projects (
              name,
              code
            )
          `
          )
          .order('code', { ascending: true })

        if (error) throw error

        // Transform data to match interface
        // Supabase returns project as an array, but we need a single object
        const transformedData: AnalyticalAccount[] = (data || []).map(
          (account: SupabaseAnalyticalAccount) => ({
            id: account.id,
            project_id: account.project_id,
            name: account.name,
            code: account.code,
            project: account.project?.[0] || { name: '', code: '' }
          })
        )

        setAccounts(transformedData)

        // Fetch projects
        const projectData = await getProjects()
        setProjects(projectData.filter((p) => p.active))

        // Fetch suppliers
        try {
          const supplierData = await getSuppliers()
          setSuppliers(supplierData)
        } catch (supErr: unknown) {
          const error = supErr as { code?: string; status?: number }
          if (error.code === 'PGRST116' || error.status === 404) {
            console.warn('La table "suppliers" semble manquante dans Supabase. Veuillez la créer.')
          } else {
            throw supErr
          }
        }
      } catch (err: unknown) {
        console.error('Error fetching data:', err)
        showNotification(`Erreur lors du chargement des données: ${getErrorMessage(err)}`, 'error')
        setIsLoadingSettings(false)
      }
    }

    fetchData()
  }, [showNotification])

  const onSubmit = async (data: RequestFormValues): Promise<void> => {
    if (!user) return

    setIsLoading(true)
    try {
      const { error } = await supabase.from('cash_requests').insert({
        requester_id: user.id,
        amount: data.amount,
        description: data.description,
        analytical_account_id: data.analytical_account_id,
        supplier_id: data.supplier_id || null,
        status: 'pending_controller'
      })

      if (error) throw error

      showNotification('Demande créée avec succès !', 'success')
      navigate('/requests')
    } catch (err: unknown) {
      console.error('Error submitting request:', err)

      // Parse error message to provide better user feedback
      const errorMessage = getErrorMessage(err)

      // Check if it's a database validation error (from our trigger)
      if (errorMessage.includes('dépasse la limite maximale')) {
        showNotification(
          `Le montant de ${data.amount.toLocaleString('fr-FR')} FCFA dépasse la limite maximale autorisée`,
          'error'
        )
      } else {
        showNotification(`Erreur lors de la création de la demande: ${errorMessage}`, 'error')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-accent rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            Nouvelle Demande de Caisse
          </h1>
          <p className="text-muted-foreground mt-1">
            Soumettre une nouvelle demande de décaissement
          </p>
        </div>
      </div>

      <div className="p-8 bg-card/50 backdrop-blur-sm rounded-2xl border border-border/50 shadow-lg hover-lift">
        {fetchError && (
          <div className="p-4 mb-6 text-sm text-destructive bg-destructive/10 rounded-xl border border-destructive/20">
            {fetchError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Amount Field */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground" htmlFor="amount">
              Montant (FCFA) <span className="text-destructive">*</span>
            </label>
            <input
              id="amount"
              type="number"
              step="1"
              className="flex h-12 w-full rounded-xl border border-input bg-background/50 backdrop-blur-sm px-4 py-3 text-sm ring-offset-background transition-all duration-200 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50 hover:border-primary/50"
              placeholder="ex: 5000"
              disabled={isLoadingSettings}
              {...register('amount', { valueAsNumber: true })}
            />
            {!isLoadingSettings && maxOutflowLimit > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <AlertCircle className="w-4 h-4" />
                <span>
                  Limite maximale: <strong>{maxOutflowLimit.toLocaleString('fr-FR')} FCFA</strong>
                </span>
              </div>
            )}
            {errors.amount && (
              <p className="text-sm text-destructive animate-in fade-in slide-in-from-top-1 duration-200">
                {errors.amount.message}
              </p>
            )}
          </div>

          {/* Project Selection Field */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground" htmlFor="project">
              Projet <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <select
                id="project"
                className="flex h-12 w-full rounded-xl border border-input bg-background/50 backdrop-blur-sm px-4 py-3 text-sm ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50 hover:border-primary/50 appearance-none"
                {...register('project_id')}
              >
                <option value="">Sélectionner un projet...</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name} {project.code ? `(${project.code})` : ''}
                  </option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                <Briefcase className="w-4 h-4" />
              </div>
            </div>
            {errors.project_id && (
              <p className="text-sm text-destructive animate-in fade-in slide-in-from-top-1 duration-200">
                {errors.project_id.message}
              </p>
            )}
          </div>

          {/* Analytical Account Field */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground" htmlFor="account">
              Compte Analytique <span className="text-destructive">*</span>
            </label>
            <Controller
              name="analytical_account_id"
              control={control}
              render={({ field }) => (
                <SearchableSelect
                  options={filteredAccounts as any}
                  value={field.value || ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  disabled={!selectedProjectId}
                  placeholder={
                    !selectedProjectId
                      ? "Veuillez d'abord sélectionner un projet"
                      : 'Sélectionner un compte...'
                  }
                  error={errors.analytical_account_id?.message}
                />
              )}
            />
            {errors.analytical_account_id && (
              <p className="text-sm text-destructive animate-in fade-in slide-in-from-top-1 duration-200">
                {errors.analytical_account_id.message}
              </p>
            )}
          </div>

          {/* Supplier Field */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground" htmlFor="supplier">
              Fournisseur
            </label>
            <Controller
              name="supplier_id"
              control={control}
              render={({ field }) => (
                <SearchableSelect
                  options={suppliers as any}
                  value={field.value || ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  placeholder="Sélectionner un fournisseur (optionnel)..."
                  error={errors.supplier_id?.message}
                />
              )}
            />
            {errors.supplier_id && (
              <p className="text-sm text-destructive animate-in fade-in slide-in-from-top-1 duration-200">
                {errors.supplier_id.message}
              </p>
            )}
          </div>

          {/* Description Field */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground" htmlFor="description">
              Description / Raison <span className="text-destructive">*</span>
            </label>
            <textarea
              id="description"
              className="flex min-h-[120px] w-full rounded-xl border border-input bg-background/50 backdrop-blur-sm px-4 py-3 text-sm ring-offset-background transition-all duration-200 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50 hover:border-primary/50 resize-none"
              placeholder="Décrivez en détail l'objet de cette dépense..."
              {...register('description')}
            />
            {errors.description && (
              <p className="text-sm text-destructive animate-in fade-in slide-in-from-top-1 duration-200">
                {errors.description.message}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-6 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-xl transition-all duration-200"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl hover:from-purple-700 hover:to-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Envoi en cours...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5 mr-2" />
                  Soumettre la Demande
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
