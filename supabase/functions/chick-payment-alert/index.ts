// Supabase Edge Function: Chick Payment Alerts
// Sends email + WhatsApp notifications for verified invoices
// Deploy: supabase functions deploy chick-payment-alert
//
// Required env vars:
//   EMAIL_PROVIDER  = "resend" | "sendgrid" | "smtp"
//   EMAIL_API_KEY   = API key for chosen provider
//   EMAIL_FROM      = sender email address
//   WHATSAPP_PROVIDER = "callmebot" | "twilio"
//   WHATSAPP_API_KEY  = API key for chosen provider
//
// Manual test via HTTP:
//   curl -X POST https://<project>.supabase.co/functions/v1/chick-payment-alert \
//     -H "Authorization: Bearer <anon-key>" \
//     -H "Content-Type: application/json" \
//     -d '{"invoice_id":"<uuid>"}'

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get pending alerts
    const { data: pendingAlerts, error: alertError } = await supabase
      .from('chick_payment_alerts')
      .select(`
        *,
        invoice:chick_supplier_invoices(
          invoice_number,
          invoice_amount,
          invoice_date,
          quantity_invoiced,
          unit_cost,
          consignment_id
        )
      `)
      .eq('status', 'PENDING')
      .order('created_at', { ascending: true })
      .limit(10);

    if (alertError) throw alertError;
    if (!pendingAlerts || pendingAlerts.length === 0) {
      return new Response(JSON.stringify({ message: 'No pending alerts' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const results: any[] = [];

    for (const alert of pendingAlerts) {
      const result: any = { alert_id: alert.id, email_sent: false, whatsapp_sent: false };

      try {
        // Get supplier name from consignment
        let supplierName = 'Supplier';
        if (alert.invoice?.consignment_id) {
          const { data: consignment } = await supabase
            .from('chick_supplier_consignments')
            .select('supplier:chick_suppliers(name)')
            .eq('id', alert.invoice.consignment_id)
            .single();
          supplierName = (consignment?.supplier as any)?.name || 'Supplier';
        }

        const subject = alert.message_subject || `Payment Due: Invoice ${alert.invoice?.invoice_number}`;
        const body = alert.message_body || buildMessage(alert, supplierName);

        // Send Email
        if (alert.channel === 'EMAIL' || alert.channel === 'BOTH') {
          if (alert.recipient_email) {
            result.email_sent = await sendEmail(alert.recipient_email, subject, body);
          }
        }

        // Send WhatsApp
        if (alert.channel === 'WHATSAPP' || alert.channel === 'BOTH') {
          if (alert.recipient_phone) {
            result.whatsapp_sent = await sendWhatsApp(alert.recipient_phone, body);
          }
        }

        // Update alert status
        const status = result.email_sent || result.whatsapp_sent ? 'SENT' : 'FAILED';
        await supabase
          .from('chick_payment_alerts')
          .update({
            status,
            sent_at: new Date().toISOString(),
            error_message: status === 'FAILED' ? 'Both email and WhatsApp failed' : null,
          })
          .eq('id', alert.id);

        results.push(result);
      } catch (err: any) {
        await supabase
          .from('chick_payment_alerts')
          .update({ status: 'FAILED', error_message: err.message })
          .eq('id', alert.id);
        results.push({ alert_id: alert.id, error: err.message });
      }
    }

    return new Response(JSON.stringify({ processed: pendingAlerts.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('Payment alert error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

function buildMessage(alert: any, supplierName: string): string {
  const inv = alert.invoice || {};
  return `HYPER MES - Payment Alert

Invoice: ${inv.invoice_number || 'N/A'}
Supplier: ${supplierName}
Amount: $${inv.invoice_amount || 0}
Quantity: ${inv.quantity_invoiced || 0} chicks
Unit Cost: $${inv.unit_cost || 0}

This invoice has been verified and is ready for payment. Please process at your earliest convenience.

View in HYPER MES: https://jkaseke1.github.io/HYPER-MES/#/chick/invoice-capture`;
}

async function sendEmail(to: string, subject: string, body: string): Promise<boolean> {
  const provider = Deno.env.get('EMAIL_PROVIDER') || 'resend';
  const apiKey = Deno.env.get('EMAIL_API_KEY');
  const fromEmail = Deno.env.get('EMAIL_FROM') || 'alerts@hypermes.com';

  if (!apiKey) {
    console.warn('EMAIL_API_KEY not set, skipping email');
    return false;
  }

  try {
    if (provider === 'resend') {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: fromEmail,
          to,
          subject,
          text: body,
        }),
      });
      return resp.ok;
    }

    if (provider === 'sendgrid') {
      const resp = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: fromEmail },
          subject,
          content: [{ type: 'text/plain', value: body }],
        }),
      });
      return resp.ok;
    }

    // Fallback: generic SMTP via a service like Mailgun, Postmark etc.
    console.warn(`Email provider "${provider}" not implemented`);
    return false;
  } catch (e: any) {
    console.error('Email send error:', e.message);
    return false;
  }
}

async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  const provider = Deno.env.get('WHATSAPP_PROVIDER') || 'callmebot';
  const apiKey = Deno.env.get('WHATSAPP_API_KEY');

  try {
    if (provider === 'callmebot') {
      // CallMeBot: https://www.callmebot.com/blog/free-api-whatsapp-messages/
      // Usage: GET https://api.callmebot.com/whatsapp.php?phone=NUMBER&text=MESSAGE&apikey=KEY
      const cleanPhone = phone.replace(/\D/g, '');
      const url = `https://api.callmebot.com/whatsapp.php?phone=${cleanPhone}&text=${encodeURIComponent(message)}&apikey=${apiKey || ''}`;
      const resp = await fetch(url);
      return resp.ok;
    }

    if (provider === 'twilio') {
      // Twilio: requires account_sid, auth_token, from_number
      const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
      const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
      const fromNumber = Deno.env.get('TWILIO_WHATSAPP_FROM');

      if (!accountSid || !authToken || !fromNumber) {
        console.warn('Twilio credentials not set');
        return false;
      }

      const resp = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            From: `whatsapp:${fromNumber}`,
            To: `whatsapp:${phone}`,
            Body: message,
          }),
        }
      );
      return resp.ok;
    }

    console.warn(`WhatsApp provider "${provider}" not implemented`);
    return false;
  } catch (e: any) {
    console.error('WhatsApp send error:', e.message);
    return false;
  }
}
