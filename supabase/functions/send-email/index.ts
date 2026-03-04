import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

interface EmailRequest {
  type: 'new_request' | 'validation'
  requestId: string
  action?: 'approve' | 'reject'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { type, requestId, action } = (await req.json()) as EmailRequest

    // 1. Fetch Request Details
    const { data: request, error: requestError } = await supabaseClient
      .from('cash_requests')
      .select(
        `
        *,
        requester:profiles!requester_id(full_name),
        analytical_account:analytical_accounts(code, name, project:projects(name))
      `
      )
      .eq('id', requestId)
      .single()

    if (requestError || !request) {
      throw new Error('Request not found')
    }

    // 2. Determine Recipients and Content
    let subject = ''
    let body = ''
    const recipients: string[] = []

    if (type === 'new_request') {
      // Notify Controller
      // Find all profiles with role 'controller'
      const { data: controllers } = await supabaseClient
        .from('profiles')
        .select('id')
        .eq('role', 'controller')

      if (controllers) {
        for (const c of controllers) {
          const { data: user } = await supabaseClient.auth.admin.getUserById(c.id)
          if (user.user?.email) recipients.push(user.user.email)
        }
      }

      subject = `[PettyCash] Nouvelle demande de ${request.requester.full_name}`
      body = `
        Une nouvelle demande de caisse a été soumise.
        
        Demandeur: ${request.requester.full_name}
        Montant: ${request.amount} FCFA
        Projet: ${request.analytical_account.project.name}
        Description: ${request.description}
        
        Veuillez vous connecter pour valider.
      `
    } else if (type === 'validation') {
      // Notify Requester
      const { data: requesterUser } = await supabaseClient.auth.admin.getUserById(
        request.requester_id
      )
      if (requesterUser.user?.email) recipients.push(requesterUser.user.email)

      if (action === 'approve') {
        subject = `[PettyCash] Demande Approuvée`
        body = `
          Votre demande de ${request.amount} FCFA a été approuvée.
          Vous pouvez vous rendre à la caisse pour le décaissement.
        `

        // Also Notify Cashier
        const { data: cashiers } = await supabaseClient
          .from('profiles')
          .select('id')
          .eq('role', 'cashier')

        if (cashiers) {
          for (const c of cashiers) {
            const { data: user } = await supabaseClient.auth.admin.getUserById(c.id)
            if (user.user?.email) recipients.push(user.user.email)
          }
        }
      } else if (action === 'reject') {
        subject = `[PettyCash] Demande Rejetée`
        body = `
          Votre demande de ${request.amount} FCFA a été rejetée.
          Raison: ${request.rejection_reason || 'Aucune raison spécifiée.'}
        `
      }
    }

    // 3. Send Email via Postfix (TCP to port 25)
    if (recipients.length > 0) {
      const hostname = 'postfix'
      const port = 25
      const conn = await Deno.connect({ hostname, port })

      const encoder = new TextEncoder()
      const decoder = new TextDecoder()
      const buffer = new Uint8Array(1024)

      const write = async (cmd: string) => {
        await conn.write(encoder.encode(cmd + '\r\n'))
        // Assume success for simplicity in this script, or read response
        await conn.read(buffer)
      }

      // Simple SMTP sequence
      // Note: This sends one email per recipient individually or uses BCC logic.
      // For simplicity, we loop through recipients and send individualized emails or just one with TO.
      // Let's send to each recipient to avoid exposing emails to each other if that's a concern,
      // but for internal notifications, a single email is often fine.
      // We will loop to be safe.

      for (const email of recipients) {
        await write('EHLO supabase-func')
        await write(`MAIL FROM: <noreply@pettycash.local>`)
        await write(`RCPT TO: <${email}>`)
        await write('DATA')
        await write(`Subject: ${subject}`)
        await write(`To: ${email}`)
        await write(`Content-Type: text/plain; charset=utf-8`)
        await write('') // Empty line between headers and body
        await write(body)
        await write('.')
        await write('RSET') // Reset for next email
      }

      await write('QUIT')
      conn.close()
    }

    return new Response(JSON.stringify({ success: true, recipients }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    })
  }
})
