import { mysqlTable, uniqueIndex, varchar } from "drizzle-orm/mysql-core"
import { id, timestamps } from "../drizzle/types"

export const AccountTable = mysqlTable("account", {
  id: id(),
  ...timestamps,
})
