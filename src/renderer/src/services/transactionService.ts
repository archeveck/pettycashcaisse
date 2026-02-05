import { supabase } from './supabase'

/**
 * Uploads a proof document for a transaction and updates the transaction record.
 * @param transactionId The ID of the transaction
 * @param file The file to upload
 * @returns The public URL of the uploaded document
 */
export const uploadTransactionProof = async (
  transactionId: string,
  file: File
): Promise<string> => {
  const fileExt = file.name.split('.').pop()
  const fileName = `${transactionId}_${Date.now()}.${fileExt}`
  const filePath = `${fileName}`

  // 1. Upload to storage
  const { error: uploadError } = await supabase.storage
    .from('proof-documents')
    .upload(filePath, file)

  if (uploadError) throw uploadError

  // 2. Get public URL
  const { data: urlData } = supabase.storage.from('proof-documents').getPublicUrl(filePath)
  const proofDocumentUrl = urlData.publicUrl

  // 3. Update transaction record
  const { error: updateError } = await supabase
    .from('cash_transactions')
    .update({
      proof_document_url: proofDocumentUrl,
      proof_submitted_at: new Date().toISOString()
    })
    .eq('id', transactionId)

  if (updateError) throw updateError

  return proofDocumentUrl
}
