import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Safaricom Daraja STK Push callback
// Configure CallBackURL to: https://<project>.lovable.app/api/public/mpesa/callback
export const Route = createFileRoute("/api/public/mpesa/callback")({
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
              const receiptNo = `CTR-${new Date().toISOString().slice(0,10).replace(/-/g,"")}-${receipt.slice(-5)}`;
              await supabaseAdmin.from("receipts").insert({
                payment_id: payment.id,
                client_id: payment.client_id,
                founder_id: payment.founder_id,
                receipt_number: receiptNo,
                amount_ksh: payment.amount_ksh,
                description: payment.description,
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
