import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../services/supabase'
import { X, Loader2, Save } from 'lucide-react'

interface Project {
    id: string
    name: string
}

interface Account {
    id: string
    name: string
    code: string
    project_id: string
}

interface EditAccountModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: (accountId: string) => Promise<void>
    currentAccountId: string
    isProcessing: boolean
}

export function EditAccountModal({
    isOpen,
    onClose,
    onConfirm,
    currentAccountId,
    isProcessing
}: EditAccountModalProps): React.ReactElement | null {
    const [projects, setProjects] = useState<Project[]>([])
    const [accounts, setAccounts] = useState<Account[]>([])
    const [selectedProjectId, setSelectedProjectId] = useState<string>('')
    const [selectedAccountId, setSelectedAccountId] = useState<string>(currentAccountId)
    const [isLoading, setIsLoading] = useState(true)

    const loadData = useCallback(async () => {
        setIsLoading(true)
        try {
            // Fetch projects
            const { data: projectsData } = await supabase
                .from('projects')
                .select('id, name')
                .eq('active', true)
                .order('name')

            if (projectsData) setProjects(projectsData)

            // Fetch accounts
            const { data: accountsData } = await supabase
                .from('analytical_accounts')
                .select('id, name, code, project_id')
                .order('name')

            if (accountsData) {
                setAccounts(accountsData)

                // Try to find the project of the current account
                const currentAccount = accountsData.find((a) => a.id === currentAccountId)
                if (currentAccount) {
                    setSelectedProjectId(currentAccount.project_id)
                }
            }
        } catch (err) {
            console.error('Error loading modal data:', err)
        } finally {
            setIsLoading(false)
        }
    }, [currentAccountId])

    useEffect(() => {
        if (isOpen) {
            loadData()
        }
    }, [isOpen, loadData])

    const filteredAccounts = accounts.filter((a) => a.project_id === selectedProjectId)

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md glass border border-border/50 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
                <div className="flex items-center justify-between p-6 border-b border-border/50 bg-muted/30">
                    <h3 className="text-xl font-semibold">Modifier l'imputation</h3>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-muted rounded-full transition-colors"
                        disabled={isProcessing}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground">Chargement des comptes...</p>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Projet</label>
                                <select
                                    value={selectedProjectId}
                                    onChange={(e) => {
                                        setSelectedProjectId(e.target.value)
                                        setSelectedAccountId('') // Reset account when project changes
                                    }}
                                    className="w-full h-11 rounded-xl border border-input bg-background px-4 py-2 text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
                                >
                                    <option value="">Sélectionner un projet</option>
                                    {projects.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Compte Analytique</label>
                                <select
                                    value={selectedAccountId}
                                    onChange={(e) => setSelectedAccountId(e.target.value)}
                                    disabled={!selectedProjectId}
                                    className="w-full h-11 rounded-xl border border-input bg-background px-4 py-2 text-sm focus:ring-2 focus:ring-primary outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <option value="">Sélectionner un compte</option>
                                    {filteredAccounts.map((a) => (
                                        <option key={a.id} value={a.id}>
                                            {a.code} - {a.name}
                                        </option>
                                    ))}
                                </select>
                                {!selectedProjectId && (
                                    <p className="text-xs text-muted-foreground italic">Sélectionnez d'abord un projet</p>
                                )}
                            </div>
                        </>
                    )}
                </div>

                <div className="flex gap-3 p-6 pt-2 border-t border-border/50 bg-muted/30">
                    <button
                        onClick={onClose}
                        disabled={isProcessing}
                        className="flex-1 h-11 px-4 py-2 text-sm font-medium rounded-xl border border-border hover:bg-muted transition-colors"
                    >
                        Annuler
                    </button>
                    <button
                        onClick={() => onConfirm(selectedAccountId)}
                        disabled={isProcessing || !selectedAccountId || selectedAccountId === currentAccountId}
                        className="flex-1 h-11 px-4 py-2 text-sm font-medium text-white bg-primary rounded-xl hover:bg-primary/90 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
                    >
                        {isProcessing ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Save className="w-5 h-5" />
                        )}
                        Enregistrer
                    </button>
                </div>
            </div>
        </div>
    )
}
