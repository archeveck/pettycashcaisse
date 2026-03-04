import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { numberToFrenchWords } from '../utils/numberToWords'
import { useRef, useState, useEffect, useCallback } from 'react'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import { PDFDocument } from 'pdf-lib'
import { Download, Printer, Loader2, FileText } from 'lucide-react'
import { useNotification } from '../contexts/NotificationContext'

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
  proof_document_url?: string | null
}

export interface BulkPrintData {
  vouchers: VoucherData[]
}

interface CashVoucherProps {
  data: VoucherData | BulkPrintData
  onClose: () => void
}

export default function CashVoucher({ data, onClose }: CashVoucherProps): React.ReactElement {
  const { showNotification } = useNotification()
  const [isGenerating, setIsGenerating] = useState(false)
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null)
  const voucherRefs = useRef<(HTMLDivElement | null)[]>([])
  const hasTriggered = useRef(false)
  const printIframeRef = useRef<HTMLIFrameElement | null>(null)
  const pdfBlobUrlRef = useRef<string | null>(null)

  // Keep ref in sync with state
  useEffect(() => {
    pdfBlobUrlRef.current = pdfBlobUrl
  }, [pdfBlobUrl])

  // Clean up blob URL on unmount
  useEffect(() => {
    return () => {
      if (pdfBlobUrlRef.current) {
        URL.revokeObjectURL(pdfBlobUrlRef.current)
      }
    }
  }, [])

  /**
   * Print the merged PDF via a hidden iframe.
   * This ensures the printed output contains the voucher + justificatif (PDF or image).
   */
  const printMergedPdf = useCallback(
    (blobUrl: string) => {
      const iframe = printIframeRef.current
      if (!iframe) return

      iframe.src = blobUrl
      iframe.onload = () => {
        try {
          iframe.contentWindow?.print()
        } catch {
          // Fallback: open in new tab if iframe print fails (e.g. cross-origin)
          window.open(blobUrl, '_blank')
          showNotification('Le PDF a été ouvert dans un nouvel onglet pour impression', 'info')
        }
      }
    },
    [showNotification]
  )

  /**
   * Generate a merged PDF containing the voucher(s) + their proof documents,
   * download it, then open the print dialog.
   */
  const generatePDF = useCallback(
    async (autoPrint = true): Promise<void> => {
      try {
        setIsGenerating(true)
        const mergedPdf = await PDFDocument.create()
        const vouchers = 'vouchers' in data ? data.vouchers : [data]

        for (let i = 0; i < vouchers.length; i++) {
          const voucher = vouchers[i]
          const element = voucherRefs.current[i]
          if (!element) {
            console.warn(`Voucher element not found for index ${i}`)
            continue
          }

          // 1. Clone the element to document.body to bypass the "Unable to find element in cloned iframe"
          // error which occurs when capturing elements inside overflow:auto containers (modals).
          const clone = element.cloneNode(true) as HTMLDivElement
          clone.style.position = 'fixed'
          clone.style.top = '-9999px'
          clone.style.left = '-9999px'
          clone.style.width = `${element.scrollWidth}px`
          clone.style.height = `${element.scrollHeight}px`
          clone.style.overflow = 'visible'
          clone.style.zIndex = '-1'
          clone.style.background = '#ffffff'
          // Remove attachment section from clone so it's not captured in the voucher page
          const attachSection = clone.querySelector('#attachment-section')
          if (attachSection) {
            attachSection.remove()
          }
          document.body.appendChild(clone)

          // html2canvas does not support oklab/oklch colors (used by Tailwind v4).
          // We sanitize these in the clone before capturing.
          const sanitizeOklab = (node: HTMLElement): void => {
            const elements = node.querySelectorAll('*')
            const allElements = [node, ...Array.from(elements)] as HTMLElement[]

            allElements.forEach((el) => {
              const styles = window.getComputedStyle(el)
              // Iterate through all computed properties to find oklab/oklch
              for (let i = 0; i < styles.length; i++) {
                const prop = styles[i]
                const val = styles.getPropertyValue(prop)

                if (val && (val.includes('oklab') || val.includes('oklch'))) {
                  // Fallback strategy: replace with safe colors
                  let fallback = '#000000'
                  if (prop.includes('background')) fallback = '#ffffff'
                  if (prop.includes('border')) fallback = '#e5e7eb'

                  // Specifically check for complex properties like box-shadow or gradients
                  if (prop === 'box-shadow' || prop === 'background-image') {
                    // Just clear them if they use unsupported colors to avoid crashes
                    el.style.setProperty(prop, 'none', 'important')
                  } else {
                    el.style.setProperty(prop, fallback, 'important')
                  }
                }
              }

              // Also check for common CSS variables that might hold these colors
              const inlineStyles = el.style.cssText
              if (inlineStyles.includes('oklab') || inlineStyles.includes('oklch')) {
                // If inline styles have these, try to strip them
                el.style.cssText = inlineStyles.replace(/oklab\([^)]+\)/g, '#000000').replace(/oklch\([^)]+\)/g, '#000000')
              }
            })
          }

          sanitizeOklab(clone)
          await new Promise((resolve) => requestAnimationFrame(resolve))

          let canvas
          try {
            canvas = await html2canvas(clone, {
              scale: 2,
              useCORS: true,
              allowTaint: true,
              backgroundColor: '#ffffff',
              logging: false,
              width: clone.scrollWidth,
              height: clone.scrollHeight
            })
          } finally {
            document.body.removeChild(clone)
          }

          const imgData = canvas.toDataURL('image/png')
          const pdf = new jsPDF('p', 'mm', 'a4')
          const pdfWidth = pdf.internal.pageSize.getWidth()
          const pdfHeight = (canvas.height * pdfWidth) / canvas.width
          pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const voucherPdfBytes = (pdf as any).output('arraybuffer') as ArrayBuffer
          const voucherPdfDoc = await PDFDocument.load(voucherPdfBytes)
          const copiedPages = await mergedPdf.copyPages(
            voucherPdfDoc,
            voucherPdfDoc.getPageIndices()
          )
          copiedPages.forEach((page) => {
            mergedPdf.addPage(page)
          })

          // 2. Add proof document (justificatif) if available
          const proofUrl = voucher.proof_document_url
          if (proofUrl) {
            try {
              const response = await fetch(proofUrl)
              if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
              }
              const attachmentBytes = await response.arrayBuffer()
              const lowerProofUrl = proofUrl.toLowerCase()

              if (lowerProofUrl.endsWith('.pdf')) {
                const attachmentPdfDoc = await PDFDocument.load(attachmentBytes)
                const attachmentPages = await mergedPdf.copyPages(
                  attachmentPdfDoc,
                  attachmentPdfDoc.getPageIndices()
                )
                attachmentPages.forEach((page) => {
                  mergedPdf.addPage(page)
                })
              } else if (
                lowerProofUrl.endsWith('.png') ||
                lowerProofUrl.endsWith('.jpg') ||
                lowerProofUrl.endsWith('.jpeg')
              ) {
                const isPng = lowerProofUrl.endsWith('.png')
                const image = isPng
                  ? await mergedPdf.embedPng(attachmentBytes)
                  : await mergedPdf.embedJpg(attachmentBytes)

                const { width, height } = image.scale(1)
                const page = mergedPdf.addPage()
                const { width: pageWidth, height: pageHeight } = page.getSize()

                // Fit the image on the page while maintaining aspect ratio
                const padding = 40
                const maxW = pageWidth - padding * 2
                const maxH = pageHeight - padding * 2
                const ratio = Math.min(maxW / width, maxH / height)
                const finalW = width * ratio
                const finalH = height * ratio

                page.drawImage(image, {
                  x: (pageWidth - finalW) / 2,
                  y: (pageHeight - finalH) / 2,
                  width: finalW,
                  height: finalH
                })
              }
            } catch (err) {
              console.error('Error adding attachment:', err)
              showNotification(
                `Impossible d'ajouter le justificatif pour ${voucher.transactionId.substring(0, 8)}`,
                'warning'
              )
            }
          }
        }

        const mergedPdfBytes = await mergedPdf.save()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const blob = new Blob([mergedPdfBytes as any], { type: 'application/pdf' })

        // Revoke previous blob URL if any
        if (pdfBlobUrlRef.current) {
          URL.revokeObjectURL(pdfBlobUrlRef.current)
        }
        const url = URL.createObjectURL(blob)
        setPdfBlobUrl(url)

        // Auto-download the PDF
        const link = document.createElement('a')
        link.href = url
        link.download =
          vouchers.length > 1
            ? 'pieces_de_caisse_groupees.pdf'
            : `piece_de_caisse_${vouchers[0].transactionId.substring(0, 8)}.pdf`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        showNotification('PDF généré et téléchargé avec succès', 'success')

        // Auto-print the merged PDF via iframe
        if (autoPrint) {
          setTimeout(() => {
            printMergedPdf(url)
          }, 600)
        }
      } catch (err) {
        console.error('Error generating merged PDF:', err)
        showNotification('Erreur lors de la génération du PDF', 'error')
      } finally {
        setIsGenerating(false)
      }
    },
    [data, showNotification, printMergedPdf]
  )

  // Auto-trigger PDF generation once voucher refs are populated
  useEffect(() => {
    if (hasTriggered.current) return

    const vouchers = 'vouchers' in data ? data.vouchers : [data]
    const expectedCount = vouchers.length

    // Poll until refs are populated (max 5 seconds)
    let attempts = 0
    const maxAttempts = 50
    const interval = setInterval(() => {
      attempts++
      const populatedRefs = voucherRefs.current.filter((ref) => ref !== null).length

      if (populatedRefs >= expectedCount || attempts >= maxAttempts) {
        clearInterval(interval)
        if (populatedRefs > 0 && !hasTriggered.current) {
          hasTriggered.current = true
          generatePDF(true)
        }
      }
    }, 100)

    return () => clearInterval(interval)
  }, [data, generatePDF])

  const renderVoucherContent = (v: VoucherData, index: number): React.ReactElement => (
    <div
      key={v.transactionId}
      id={`voucher-${v.transactionId}`}
      ref={(el) => {
        voucherRefs.current[index] = el
      }}
      className={index > 0 ? 'pt-12 border-t-2 border-dashed border-gray-300' : ''}
    >
      <VoucherContent data={v} />
    </div>
  )

  return (
    <>
      {/* Hidden iframe for printing the merged PDF */}
      <iframe
        ref={printIframeRef}
        style={{ display: 'none' }}
        title="print-frame"
      />

      {/* Screen-only modal */}
      <div className="print:hidden fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto">
          <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center z-10">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold">Pièce de Caisse</h2>
              {isGenerating && (
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Fusion en cours…
                </span>
              )}
              {pdfBlobUrl && !isGenerating && (
                <span className="text-sm text-green-600 font-medium">✓ PDF prêt</span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => generatePDF(false)}
                disabled={isGenerating}
                className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 flex items-center gap-2"
                title="Re-télécharger le PDF fusionné"
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Télécharger PDF
              </button>
              <button
                onClick={() => {
                  if (pdfBlobUrl) {
                    printMergedPdf(pdfBlobUrl)
                  } else {
                    showNotification('Veuillez attendre la fin de la génération du PDF', 'warning')
                  }
                }}
                disabled={isGenerating || !pdfBlobUrl}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 flex items-center gap-2 disabled:opacity-50"
              >
                <Printer className="w-4 h-4" />
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

          {/* Voucher content preview */}
          <div className="p-8 space-y-12">
            {'vouchers' in data
              ? data.vouchers.map((v, i) => renderVoucherContent(v, i))
              : renderVoucherContent(data as VoucherData, 0)}
          </div>
        </div>
      </div>
    </>
  )
}

function VoucherContent({ data }: { data: VoucherData }): React.ReactElement {
  const amountInWords = numberToFrenchWords(data.amount)

  return (
    <div className="voucher-container font-sans text-black py-4 print:py-0 break-inside-avoid">
      {/* Header */}
      <div className="text-center mb-8 pb-4 border-b-2 border-black">
        <h1 className="text-2xl font-bold mb-2 text-primary uppercase">PIÈCE DE CAISSE</h1>
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          ESTIA SYNERGIE
        </p>
      </div>

      {/* Voucher Info */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-muted/30 p-3 rounded-lg border border-border/50">
          <p className="text-xs text-muted-foreground uppercase tracking-tight">N° de Pièce</p>
          <p className="font-mono font-bold text-lg text-primary">
            {data.transactionId.substring(0, 8).toUpperCase()}
          </p>
        </div>
        <div className="text-right bg-muted/30 p-3 rounded-lg border border-border/50">
          <p className="text-xs text-muted-foreground uppercase tracking-tight">Date</p>
          <p className="font-bold">
            {format(new Date(data.date), 'dd MMMM yyyy à HH:mm', { locale: fr })}
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="border-2 border-primary/20 bg-card rounded-xl p-6 mb-6 shadow-sm">
        <div className="mb-4">
          <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Bénéficiaire</p>
          <p className="font-bold text-xl text-primary">{data.requesterName}</p>
        </div>

        <div className="mb-4">
          <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">
            Montant (chiffres)
          </p>
          <p className="font-bold text-3xl text-primary">
            {new Intl.NumberFormat('fr-FR', {
              style: 'currency',
              currency: 'XOF'
            }).format(data.amount)}
          </p>
        </div>

        <div className="mb-4">
          <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">
            Montant (lettres)
          </p>
          <p className="font-medium capitalize italic border-b border-border pb-1">
            {amountInWords} francs CFA
          </p>
        </div>

        <div className="mb-4 border-l-4 border-primary/30 pl-4 py-1">
          <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">
            Objet / Description
          </p>
          <p className="font-medium text-lg leading-relaxed">{data.description}</p>
        </div>

        <div className="grid grid-cols-2 gap-6 mt-6 pt-4 border-t border-border/50">
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">
              Compte Analytique
            </p>
            <p className="font-bold text-primary">{data.analyticalAccount.code}</p>
            <p className="text-sm text-muted-foreground font-medium">
              {data.analyticalAccount.name}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Projet</p>
            <p className="font-bold text-primary">{data.analyticalAccount.project.name}</p>
          </div>
        </div>
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-3 gap-8 mt-12 bg-muted/20 p-6 rounded-2xl border border-border/50">
        <div className="text-center group">
          <div className="h-20 flex items-center justify-center italic text-muted-foreground/30 text-xs">
            Signature
          </div>
          <div className="border-t-2 border-primary/40 pt-3">
            <p className="font-bold text-primary">Bénéficiaire</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest leading-none mt-1">
              {data.requesterName}
            </p>
          </div>
        </div>
        <div className="text-center group">
          <div className="h-20 flex items-center justify-center italic text-muted-foreground/30 text-xs">
            Signature
          </div>
          <div className="border-t-2 border-primary/40 pt-3">
            <p className="font-bold text-primary">Caissier(ère)</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest leading-none mt-1">
              {data.cashierName || 'Non défini'}
            </p>
          </div>
        </div>
        <div className="text-center group">
          <div className="h-20 flex items-center justify-center italic text-muted-foreground/30 text-xs">
            Signature
          </div>
          <div className="border-t-2 border-primary/40 pt-3">
            <p className="font-bold text-primary">Contrôleur</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest leading-none mt-1">
              Validation Finale
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-10 pt-4 border-t border-border/30 text-center">
        <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-2">
          <span>Document officiel généré numériquement le</span>
          <span className="font-bold text-primary/70">
            {format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr })}
          </span>
        </p>
      </div>

      {/* Attachment Section (screen preview only) */}
      {data.proof_document_url && (
        <div
          id="attachment-section"
          className="mt-12 pt-8 border-t-2 border-dashed border-border/40"
        >
          <div className="flex items-center justify-center gap-3 mb-6">
            <FileText className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold text-primary tracking-tight uppercase">
              PIÈCE JUSTIFICATIVE
            </h2>
          </div>
          <div className="flex justify-center bg-muted/10 p-4 rounded-2xl border border-border shadow-inner">
            {data.proof_document_url.toLowerCase().endsWith('.pdf') ? (
              <div className="p-8 bg-card rounded-xl text-center border shadow-sm max-w-md">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-primary" />
                </div>
                <p className="font-bold text-primary">Document PDF attaché</p>
                <p className="text-xs text-muted-foreground mt-2 line-clamp-1 opacity-60 italic">
                  {data.proof_document_url}
                </p>
                <p className="text-xs font-semibold text-primary mt-4 py-1 px-3 bg-primary/5 rounded-full inline-block uppercase">
                  Inclus dans le PDF fusionné
                </p>
              </div>
            ) : (
              <img
                src={`${data.proof_document_url}?v=${Date.now()}`}
                alt="Justificatif"
                className="max-w-full h-auto max-h-[800px] object-contain rounded-lg shadow-md border border-border"
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
