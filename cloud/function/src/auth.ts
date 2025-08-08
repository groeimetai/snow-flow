import { Resource } from "sst"
import { z } from "zod"
import { issuer } from "@openauthjs/openauth"
import { createSubjects } from "@openauthjs/openauth/subject"
import { GithubProvider } from "@openauthjs/openauth/provider/github"
import { CloudflareStorage } from "@openauthjs/openauth/storage/cloudflare"
import { Account } from "@opencode/cloud-core/account.js"

type Env = {
  AuthStorage: KVNamespace
}

export const subjects = createSubjects({
  account: z.object({
    accountID: z.string(),
    email: z.string(),
  }),
  user: z.object({
    userID: z.string(),
    workspaceID: z.string(),
  }),
})

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return issuer({
      providers: {
        github: GithubProvider({
          clientID: Resource.GITHUB_CLIENT_ID_CONSOLE.value,
          clientSecret: Resource.GITHUB_CLIENT_SECRET_CONSOLE.value,
          scopes: ["read:user", "user:email"],
        }),
      },
      storage: CloudflareStorage({
        namespace: env.AuthStorage,
      }),
      subjects,
      async success(ctx, response) {
        console.log(response)

        let email: string | undefined

        if (response.provider === "github") {
          const userResponse = await fetch("https://api.github.com/user", {
            headers: {
              Authorization: `Bearer ${response.tokenset.access}`,
              "User-Agent": "opencode",
              Accept: "application/vnd.github+json",
            },
          })
          const user = (await userResponse.json()) as { email: string }
          email = user.email
        } else throw new Error("Unsupported provider")

        if (!email) throw new Error("No email found")

        let accountID = await Account.fromEmail(email).then((x) => x?.id)
        if (!accountID) {
          console.log("creating account for", email)
          accountID = await Account.create({
            email: email!,
          })
        }
        return ctx.subject("account", accountID, { accountID, email })
      },
    }).fetch(request, env, ctx)
  },
}
