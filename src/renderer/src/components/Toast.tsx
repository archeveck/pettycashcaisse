import { useEffect } from 'react'
import { X, CheckCircle, XCircle, Info, AlertTriangle } from 'lucide-react'

export type NotificationType = 'success' | 'error' | 'info' | 'warning'

export interface ToastProps {
    id: string
    message: string
    type: NotificationType
    onClose: (id: string) => void
    duration?: number
}

const typeConfig = {
    success: {
        icon: CheckCircle,
        gradient: 'from-green-600 to-emerald-600',
        bgColor: 'bg-green-50',
        textColor: 'text-green-900',
        borderColor: 'border-green-200'
    },
    error: {
        icon: XCircle,
        gradient: 'from-red-600 to-rose-600',
        bgColor: 'bg-red-50',
        textColor: 'text-red-900',
        borderColor: 'border-red-200'
    },
    info: {
        icon: Info,
        gradient: 'from-blue-600 to-cyan-600',
        bgColor: 'bg-blue-50',
        textColor: 'text-blue-900',
        borderColor: 'border-blue-200'
    },
    warning: {
        icon: AlertTriangle,
        gradient: 'from-orange-600 to-amber-600',
        bgColor: 'bg-orange-50',
        textColor: 'text-orange-900',
        borderColor: 'border-orange-200'
    }
}

export default function Toast({ id, message, type, onClose, duration = 5000 }: ToastProps) {
    const config = typeConfig[type]
    const Icon = config.icon

    useEffect(() => {
        const timer = setTimeout(() => {
            onClose(id)
        }, duration)

        return () => clearTimeout(timer)
    }, [id, duration, onClose])

    return (
        <div
            className={`flex items-start gap-3 p-4 rounded-xl border ${config.borderColor} ${config.bgColor} shadow-lg backdrop-blur-sm animate-slide-in-right min-w-[320px] max-w-md`}
        >
            <div className={`p-2 rounded-lg bg-gradient-to-r ${config.gradient}`}>
                <Icon className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
                <p className={`text-sm font-medium ${config.textColor}`}>{message}</p>
            </div>
            <button
                onClick={() => onClose(id)}
                className={`p-1 rounded-lg hover:bg-black/5 transition-colors ${config.textColor}`}
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    )
}
