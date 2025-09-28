import { mysqlTable, uniqueIndex, varchar, int, mysqlEnum } from "drizzle-orm/mysql-core"
import { timestamps, utc, workspaceColumns } from "../drizzle/types"
import { workspaceIndexes } from "./workspace.sql"

const UserRole = ["admin", "member"] as const
export type UserRole = (typeof UserRole)[number]

export const UserTable = mysqlTable(
  "user",
  {
    ...workspaceColumns,
    ...timestamps,
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    timeSeen: utc("time_seen"),
    timeJoined: utc("time_joined"),
    color: int("color"),
    role: mysqlEnum("role", ["admin", "member"]),
  },
  (table) => [...workspaceIndexes(table), uniqueIndex("user_email").on(table.workspaceID, table.email)],
)
