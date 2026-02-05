import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { numberToFrenchWords } from '../utils/numberToWords'

export interface VoucherData {
    transactionId: string
    date: string
    requesterName: string
    amount: number
    description: string
    analyticalAccount: {
        code: string
        name: string
        project: {
            name: string
        }
    }
    cashierName?: string
}

interface CashVoucherProps {
    data: VoucherData
    onClose: () => void
}

export default function CashVoucher({ data, onClose }: CashVoucherProps): React.ReactElement {
    const handlePrint = (): void => {
        window.print()
    }

    return (
        <>
            {/* Screen-only controls */}
            <div className="print:hidden fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto">
                    <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
                        <h2 className="text-xl font-bold">Pièce de Caisse</h2>
                        <div className="flex gap-2">
                            <button
                                onClick={handlePrint}
                                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                            >
                                Imprimer
                            </button>
                            <button
                                onClick={onClose}
                                className="px-4 py-2 border border-border rounded-md hover:bg-secondary"
                            >
                                Fermer
                            </button>
                        </div>
                    </div>

                    {/* Voucher content (visible on screen and print) */}
                    <div className="p-8">
                        <VoucherContent data={data} />
                    </div>
                </div>
            </div>

            {/* Print-only version */}
            <div className="hidden print:block">
                <VoucherContent data={data} />
            </div>
        </>
    )
}

function VoucherContent({ data }: { data: VoucherData }): React.ReactElement {
    const amountInWords = numberToFrenchWords(data.amount)

    return (
        <div className="voucher-content font-sans text-black">
            <style>
                {`
          @media print {
            @page {
              size: A4;
              margin: 1cm;
            }
            body {
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }
            .voucher-content {
              width: 100%;
              max-width: 100%;
            }
          }
        `}
            </style>

            {/* Header */}
            <div className="text-center mb-8 pb-4 border-b-2 border-black">
                <h1 className="text-2xl font-bold mb-2">PIÈCE DE CAISSE</h1>
                <p className="text-sm text-gray-600">ESTIA SYNERGIE</p>
            </div>

            {/* Voucher Info */}
            <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                    <p className="text-sm text-gray-600">N° de Pièce</p>
                    <p className="font-mono font-bold">{data.transactionId.substring(0, 8).toUpperCase()}</p>
                </div>
                <div className="text-right">
                    <p className="text-sm text-gray-600">Date</p>
                    <p className="font-bold">
                        {format(new Date(data.date), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                    </p>
                </div>
            </div>

            {/* Main Content */}
            <div className="border-2 border-black p-6 mb-6">
                <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-1">Bénéficiaire</p>
                    <p className="font-bold text-lg">{data.requesterName}</p>
                </div>

                <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-1">Montant (chiffres)</p>
                    <p className="font-bold text-2xl">
                        {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(
                            data.amount
                        )}
                    </p>
                </div>

                <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-1">Montant (lettres)</p>
                    <p className="font-medium capitalize border-b border-gray-400 pb-1">
                        {amountInWords} francs CFA
                    </p>
                </div>

                <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-1">Objet / Description</p>
                    <p className="font-medium">{data.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-sm text-gray-600 mb-1">Compte Analytique</p>
                        <p className="font-medium">{data.analyticalAccount.code}</p>
                        <p className="text-sm text-gray-500">{data.analyticalAccount.name}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600 mb-1">Projet</p>
                        <p className="font-medium">{data.analyticalAccount.project.name}</p>
                    </div>
                </div>
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-3 gap-8 mt-12">
                <div className="text-center">
                    <div className="border-t-2 border-black pt-2 mt-16">
                        <p className="font-bold">Bénéficiaire</p>
                        <p className="text-sm text-gray-600">Signature</p>
                    </div>
                </div>
                <div className="text-center">
                    <div className="border-t-2 border-black pt-2 mt-16">
                        <p className="font-bold">Caissier(ère)</p>
                        <p className="text-sm text-gray-600">
                            {data.cashierName || 'Signature'}
                        </p>
                    </div>
                </div>
                <div className="text-center">
                    <div className="border-t-2 border-black pt-2 mt-16">
                        <p className="font-bold">Contrôleur</p>
                        <p className="text-sm text-gray-600">Signature</p>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="mt-12 pt-4 border-t border-gray-300 text-center text-xs text-gray-500">
                <p>Document généré le {format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr })}</p>
            </div>
        </div>
    )
}
