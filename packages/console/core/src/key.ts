import { z } from "zod"
import { fn } from "./util/fn"
import { Actor } from "./actor"
import { and, Database, eq, isNull, sql } from "./drizzle"
import { Identifier } from "./identifier"
import { KeyTable } from "./schema/key.sql"
import { AccountTable } from "./schema/account.sql"
import { UserTable } from "./schema/user.sql"
import { User } from "./user"

export namespace Key {
  export const list = fn(z.void(), async () => {
    const userID = Actor.assert("user").properties.userID
    const user = await User.fromID(userID)
    const keys = await Database.use((tx) =>
      tx
        .select({
          id: KeyTable.id,
          name: KeyTable.name,
          key: KeyTable.key,
          timeUsed: KeyTable.timeUsed,
          userID: KeyTable.userID,
          email: AccountTable.email,
        })
        .from(KeyTable)
        .innerJoin(UserTable, and(eq(KeyTable.userID, UserTable.id), eq(KeyTable.workspaceID, UserTable.workspaceID)))
        .innerJoin(AccountTable, eq(UserTable.accountID, AccountTable.id))
        .where(
          and(
            ...[
              eq(KeyTable.workspaceID, Actor.workspace()),
              isNull(KeyTable.timeDeleted),
              ...(user.role === "admin" ? [] : [eq(KeyTable.userID, userID)]),
            ],
          ),
        )
        .orderBy(sql`${KeyTable.name} DESC`),
    )
    // only return value for user's keys
    return keys.map((key) => ({
      ...key,
      key: key.userID === userID ? key.key : undefined,
      keyDisplay: `${key.key.slice(0, 7)}...${key.key.slice(-4)}`,
    }))
  })

  export const create = fn(
    z.object({
      userID: z.string(),
      name: z.string().min(1).max(255),
    }),
    async (input) => {
      const { name } = input

      // Generate secret key: sk- + 64 random characters (upper, lower, numbers)
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
      let secretKey = "sk-"
      const array = new Uint32Array(64)
      crypto.getRandomValues(array)
      for (let i = 0, l = array.length; i < l; i++) {
        secretKey += chars[array[i] % chars.length]
      }
      const keyID = Identifier.create("key")

      await Database.use((tx) =>
        tx.insert(KeyTable).values({
          id: keyID,
          workspaceID: Actor.workspace(),
          userID: input.userID,
          name,
          key: secretKey,
          timeUsed: null,
        }),
      )

      return keyID
    },
  )

  export const remove = fn(z.object({ id: z.string() }), async (input) => {
    const workspace = Actor.workspace()
    await Database.transaction((tx) =>
      tx
        .update(KeyTable)
        .set({
          timeDeleted: sql`now()`,
        })
        .where(and(eq(KeyTable.id, input.id), eq(KeyTable.workspaceID, workspace))),
    )
  })
}
