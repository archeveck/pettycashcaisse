import { supabase } from './supabase'

/**
 * Uploads a proof document for a cash request and updates the request record.
 * @param requestId The ID of the cash request
 * @param file The file to upload
 * @returns The public URL of the uploaded document
 */
export const uploadRequestProof = async (
  requestId: string,
  file: File
): Promise<string> => {
  const fileExt = file.name.split('.').pop()
  const fileName = `req_${requestId}_${Date.now()}.${fileExt}`
  const filePath = `${fileName}`

  // 1. Upload to storage
  const { error: uploadError } = await supabase.storage
    .from('proof-documents')
    .upload(filePath, file)

  if (uploadError) throw uploadError

  // 2. Get public URL
  const { data: urlData } = supabase.storage.from('proof-documents').getPublicUrl(filePath)
  const proofDocumentUrl = urlData.publicUrl

  // 3. Update request record
  const { error: updateError } = await supabase
    .from('cash_requests')
    .update({
      proof_document_url: proofDocumentUrl,
      proof_submitted_at: new Date().toISOString()
    })
    .eq('id', requestId)

  if (updateError) throw updateError

  return proofDocumentUrl
}
