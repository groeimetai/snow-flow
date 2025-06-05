// Example: https://claude.ai/oauth/authorize?code=true&client_id=9d1c250a-e61b-44d9-88ed-5944d1962f5e&response_type=code&redirect_uri=https%3A%2F%2Fconsole.anthropic.com%2Foauth%2Fcode%2Fcallback&scope=org%3Acreate_api_key+user%3Aprofile+user%3Ainference&code_challenge=MdFtFgFap23AWDSN0oa3-eaKjQRFE4CaEhXx8M9fHZg&code_challenge_method=S256&state=rKLtaDzm88GSwekyEqdi0wXX-YqIr13tSzYymSzpvfs

import { generatePKCE } from "@openauthjs/openauth/pkce"
import { Global } from "../global"
import path from "path"

export namespace AuthAnthropic {
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

  export async function load() {
    const file = Bun.file(path.join(Global.Path.data, "anthropic.json"))
    if (!(await file.exists())) return
    const result = await file.json()
    return {
      accessToken: result.access_token as string,
      refreshToken: result.refresh_token as string,
    }
  }

  export class ExchangeFailed extends Error {
    constructor() {
      super("Exchange failed")
    }
  }
}
