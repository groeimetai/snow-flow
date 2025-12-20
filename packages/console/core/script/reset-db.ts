import { Resource } from "@groeimetai/snow-flow-console-resource"
import { Database } from "@groeimetai/snow-flow-console-core/drizzle/index.js"
import { UserTable } from "@groeimetai/snow-flow-console-core/schema/user.sql.js"
import { AccountTable } from "@groeimetai/snow-flow-console-core/schema/account.sql.js"
import { WorkspaceTable } from "@groeimetai/snow-flow-console-core/schema/workspace.sql.js"
import { BillingTable, PaymentTable, UsageTable } from "@groeimetai/snow-flow-console-core/schema/billing.sql.js"
import { KeyTable } from "@groeimetai/snow-flow-console-core/schema/key.sql.js"

if (Resource.App.stage !== "frank") throw new Error("This script is only for frank")

for (const table of [AccountTable, BillingTable, KeyTable, PaymentTable, UsageTable, UserTable, WorkspaceTable]) {
  await Database.use((tx) => tx.delete(table))
}
