import { z } from "zod"
import { and, eq, getTableColumns, inArray, isNull, or, sql } from "drizzle-orm"
import { fn } from "./util/fn"
import { Database } from "./drizzle"
import { UserRole, UserTable } from "./schema/user.sql"
import { Actor } from "./actor"
import { Identifier } from "./identifier"
import { render } from "@jsx-email/render"
import { AWS } from "./aws"
import { Account } from "./account"
import { AccountTable } from "./schema/account.sql"
import { Key } from "./key"

export namespace User {
  const assertAdmin = async () => {
    const actor = Actor.assert("user")
    const user = await User.fromID(actor.properties.userID)
    if (user?.role !== "admin") {
      throw new Error(`Expected admin user, got ${user?.role}`)
    }
  }

  const assertNotSelf = (id: string) => {
    const actor = Actor.assert("user")
    if (actor.properties.userID === id) {
      throw new Error(`Expected not self actor, got self actor`)
    }
  }

  export const list = fn(z.void(), () =>
    Database.use((tx) =>
      tx
        .select({
          ...getTableColumns(UserTable),
          accountEmail: AccountTable.email,
        })
        .from(UserTable)
        .leftJoin(AccountTable, eq(UserTable.accountID, AccountTable.id))
        .where(and(eq(UserTable.workspaceID, Actor.workspace()), isNull(UserTable.timeDeleted))),
    ),
  )

  export const fromID = fn(z.string(), (id) =>
    Database.use((tx) =>
      tx
        .select()
        .from(UserTable)
        .where(and(eq(UserTable.workspaceID, Actor.workspace()), eq(UserTable.id, id), isNull(UserTable.timeDeleted)))
        .then((rows) => rows[0]),
    ),
  )

  export const getAccountEmail = fn(z.string(), (id) =>
    Database.use((tx) =>
      tx
        .select({
          email: AccountTable.email,
        })
        .from(UserTable)
        .leftJoin(AccountTable, eq(UserTable.accountID, AccountTable.id))
        .where(and(eq(UserTable.workspaceID, Actor.workspace()), eq(UserTable.id, id)))
        .then((rows) => rows[0]?.email),
    ),
  )

  export const invite = fn(
    z.object({
      email: z.string(),
      role: z.enum(UserRole),
    }),
    async ({ email, role }) => {
      await assertAdmin()

      const workspaceID = Actor.workspace()
      await Database.transaction(async (tx) => {
        const account = await Account.fromEmail(email)
        const existing = await tx
          .select()
          .from(UserTable)
          .where(
            and(
              eq(UserTable.workspaceID, Actor.workspace()),
              account ? eq(UserTable.oldAccountID, account.id) : eq(UserTable.oldEmail, email),
            ),
          )
          .then((rows) => rows[0])

        // case: previously invited and removed
        if (existing) {
          await tx
            .update(UserTable)
            .set({
              role,
              timeDeleted: null,
              ...(account
                ? {
                    oldAccountID: null,
                    accountID: account.id,
                  }
                : {
                    oldEmail: null,
                    email,
                  }),
            })
            .where(and(eq(UserTable.workspaceID, existing.workspaceID), eq(UserTable.id, existing.id)))
        }
        // case: account previously not invited
        else {
          await tx
            .insert(UserTable)
            .values({
              id: Identifier.create("user"),
              name: "",
              ...(account
                ? {
                    accountID: account.id,
                  }
                : {
                    email,
                  }),
              workspaceID,
              role,
            })
            .catch((e: any) => {
              if (e.message.match(/Duplicate entry '.*' for key 'user.user_account_id'/))
                throw new Error("A user with this email has already been invited.")
              if (e.message.match(/Duplicate entry '.*' for key 'user.user_email'/))
                throw new Error("A user with this email has already been invited.")
              throw e
            })
        }
      })

      // send email, ignore errors
      try {
        const { InviteEmail } = await import("@opencode/console-mail/InviteEmail.jsx")
        await AWS.sendEmail({
          to: email,
          subject: `You've been invited to join the ${workspaceID} workspace on OpenCode Zen`,
          body: render(
            // @ts-ignore
            InviteEmail({
              assetsUrl: `https://opencode.ai/email`,
              workspace: workspaceID,
            }),
          ),
        })
      } catch (e) {
        console.error(e)
      }
    },
  )

  export const joinInvitedWorkspaces = fn(z.void(), async () => {
    const account = Actor.assert("account")
    const invitations = await Database.use(async (tx) => {
      const invitations = await tx
        .select({
          id: UserTable.id,
          workspaceID: UserTable.workspaceID,
        })
        .from(UserTable)
        .where(eq(UserTable.email, account.properties.email))

      await tx
        .update(UserTable)
        .set({
          accountID: account.properties.accountID,
          email: null,
        })
        .where(eq(UserTable.email, account.properties.email))
      return invitations
    })

    await Promise.all(
      invitations.map((invite) =>
        Actor.provide(
          "system",
          {
            workspaceID: invite.workspaceID,
          },
          () => Key.create({ name: "Default API Key" }),
        ),
      ),
    )

    return invitations.length
  })

  export const updateRole = fn(
    z.object({
      id: z.string(),
      role: z.enum(UserRole),
    }),
    async ({ id, role }) => {
      await assertAdmin()
      if (role === "member") assertNotSelf(id)
      return await Database.use((tx) =>
        tx
          .update(UserTable)
          .set({ role })
          .where(and(eq(UserTable.id, id), eq(UserTable.workspaceID, Actor.workspace()))),
      )
    },
  )

  export const remove = fn(z.string(), async (id) => {
    await assertAdmin()
    assertNotSelf(id)

    return await Database.transaction(async (tx) => {
      const user = await fromID(id)
      if (!user) throw new Error("User not found")

      await tx
        .update(UserTable)
        .set({
          ...(user.email
            ? {
                oldEmail: user.email,
                email: null,
              }
            : {
                oldAccountID: user.accountID,
                accountID: null,
              }),
          timeDeleted: sql`now()`,
        })
        .where(and(eq(UserTable.id, id), eq(UserTable.workspaceID, Actor.workspace())))
    })
  })
}
