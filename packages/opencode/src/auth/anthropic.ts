import { generatePKCE } from "@openauthjs/openauth/pkce"
import { Global } from "../global"
import path from "path"

export namespace AuthAnthropic {
  const CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e"

  export async function authorize() {
    const pkce = await generatePKCE()
    const url = new URL("https://claude.ai/oauth/authorize", import.meta.url)
    url.searchParams.set("code", "true")
    url.searchParams.set("client_id", "9d1c250a-e61b-44d9-88ed-5944d1962f5e")
    url.searchParams.set("response_type", "code")
    url.searchParams.set(
      "redirect_uri",
      "https://console.anthropic.com/oauth/code/callback",
    )
    url.searchParams.set(
      "scope",
      "org:create_api_key user:profile user:inference",
    )
    url.searchParams.set("code_challenge", pkce.challenge)
    url.searchParams.set("code_challenge_method", "S256")
    url.searchParams.set("state", pkce.verifier)
    return {
      url: url.toString(),
      verifier: pkce.verifier,
    }
  }

  export async function exchange(code: string, verifier: string) {
    const splits = code.split("#")
    const result = await fetch("https://console.anthropic.com/v1/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code: splits[0],
        state: splits[1],
        grant_type: "authorization_code",
        client_id: "9d1c250a-e61b-44d9-88ed-5944d1962f5e",
        redirect_uri: "https://console.anthropic.com/oauth/code/callback",
        code_verifier: verifier,
      }),
    })
    if (!result.ok) throw new ExchangeFailed()
    await Bun.write(path.join(Global.Path.data, "anthropic.json"), result)
  }

  export async function access() {
    const file = Bun.file(path.join(Global.Path.data, "anthropic.json"))
    if (!(await file.exists())) return
    const result = await file.json()
    const refresh = result.refresh_token
    const response = await fetch(
      "https://console.anthropic.com/v1/oauth/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          grant_type: "refresh_token",
          refresh_token: refresh,
          client_id: CLIENT_ID,
        }),
      },
    )
    if (!response.ok) return
    const json = await response.json()
    await Bun.write(file, JSON.stringify(json))
    return json.access_token as string
  }

  export class ExchangeFailed extends Error {
    constructor() {
      super("Exchange failed")
    }
  }
}
