import { useNavigate } from 'react-router-dom'

export default function Unauthorized(): React.ReactElement {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-background text-foreground">
      <h1 className="text-4xl font-bold text-destructive mb-4">403 - Non Autorisé</h1>
      <p className="text-lg text-muted-foreground mb-8">
        Vous n&apos;avez pas la permission d&apos;accéder à cette page.
      </p>
      <button
        onClick={() => navigate('/')}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
      >
        Aller au Tableau de Bord
      </button>
    </div>
  )
}
