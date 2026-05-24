import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Safaricom Daraja STK Push callback
// Configure CallBackURL to: https://<project>.lovable.app/api/public/mpesa/callback
export const Route = createFileRoute("/api/public/mpesa/callback")({
  component: () => null,
  ssr: false,
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const stk = body?.Body?.stkCallback;
          if (!stk) return new Response("ignored", { status: 200 });

          const checkoutId: string = stk.CheckoutRequestID;
          const resultCode: number = stk.ResultCode;
          const items: any[] = stk.CallbackMetadata?.Item ?? [];
          const get = (n: string) => items.find((i) => i.Name === n)?.Value;

          if (resultCode === 0) {
            const receipt = String(get("MpesaReceiptNumber") ?? "");
            const { data: payment } = await supabaseAdmin
              .from("payments")
              .update({
                status: "paid",
                mpesa_receipt_number: receipt,
                paid_at: new Date().toISOString(),
              })
              .eq("mpesa_checkout_request_id", checkoutId)
              .select()
              .single();

            if (payment) {
              const d = new Date();
              const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2,"0")}`;
              const tail = (receipt || Math.random().toString(36).slice(2)).toUpperCase().replace(/[^A-Z0-9]/g,"").slice(-4) || "XXXX";
              const receiptNo = `COT-${ym}-${tail}`;
              await supabaseAdmin.from("receipts").insert({
                payment_id: payment.id,
                client_id: payment.client_id,
                founder_id: payment.founder_id,
                receipt_number: receiptNo,
                amount_ksh: payment.amount_ksh,
                description: payment.description,
              });
              // Queue a WhatsApp confirmation row (real delivery handled by WhatsApp worker)
              const { data: client } = await supabaseAdmin
                .from("clients").select("full_name").eq("id", payment.client_id).single();
              const name = client?.full_name?.split(" ")[0] ?? "there";
              await supabaseAdmin.from("whatsapp_messages").insert({
                client_id: payment.client_id,
                template_key: "payment_confirmation",
                body: `Thank you ${name}. We've received ${payment.amount_ksh} KSH. M-Pesa receipt: ${receipt}. — COTERIE`,
                status: "sent",
                created_by: "system:mpesa",
              });
              await supabaseAdmin.from("activity_log").insert({
                action: "payment_paid",
                entity: "payment",
                entity_id: payment.id,
                actor: "system:mpesa",
                metadata: { receipt, amount: payment.amount_ksh },
              });
            }
          } else {
            await supabaseAdmin
              .from("payments")
              .update({ status: "failed", failure_reason: stk.ResultDesc ?? "STK failed" })
              .eq("mpesa_checkout_request_id", checkoutId);
          }

          return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
        } catch (e) {
          console.error("mpesa callback error", e);
          return Response.json({ ResultCode: 1, ResultDesc: "Error" }, { status: 200 });
        }
      },
    },
  },
});
