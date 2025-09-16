import { Billing } from "@opencode/cloud-core/billing.js"
import { query, action, useParams, createAsync, useAction } from "@solidjs/router"
import { For } from "solid-js"
import { withActor } from "~/context/auth.withActor"
import { formatDateUTC, formatDateForTable } from "./common"
import styles from "./payment-section.module.css"

const getPaymentsInfo = query(async (workspaceID: string) => {
  "use server"
  return withActor(async () => {
    return await Billing.payments()
  }, workspaceID)
}, "payment.list")

const downloadReceipt = action(async (workspaceID: string, paymentID: string) => {
  "use server"
  return withActor(() => Billing.generateReceiptUrl({ paymentID }), workspaceID)
}, "receipt.download")

export function PaymentSection() {
  const params = useParams()
  const payments = createAsync(() => getPaymentsInfo(params.id))
  const downloadReceiptAction = useAction(downloadReceipt)

  return (
    payments() &&
    payments()!.length > 0 && (
      <section class={styles.root}>
        <div data-slot="section-title">
          <h2>Payments History</h2>
          <p>Recent payment transactions.</p>
        </div>
        <div data-slot="payments-table">
          <table data-slot="payments-table-element">
            <thead>
              <tr>
                <th>Date</th>
                <th>Payment ID</th>
                <th>Amount</th>
                <th>Receipt</th>
              </tr>
            </thead>
            <tbody>
              <For each={payments()!}>
                {(payment) => {
                  const date = new Date(payment.timeCreated)
                  return (
                    <tr>
                      <td data-slot="payment-date" title={formatDateUTC(date)}>
                        {formatDateForTable(date)}
                      </td>
                      <td data-slot="payment-id">{payment.id}</td>
                      <td data-slot="payment-amount">${((payment.amount ?? 0) / 100000000).toFixed(2)}</td>
                      <td data-slot="payment-receipt">
                        <button
                          onClick={async () => {
                            const receiptUrl = await downloadReceiptAction(params.id, payment.paymentID!)
                            if (receiptUrl) {
                              window.open(receiptUrl, "_blank")
                            }
                          }}
                          data-slot="receipt-button"
                          style="cursor: pointer;"
                        >
                          download
                        </button>
                      </td>
                    </tr>
                  )
                }}
              </For>
            </tbody>
          </table>
        </div>
      </section>
    )
  )
}
