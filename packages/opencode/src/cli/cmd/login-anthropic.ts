import { AuthAnthropic } from "../../auth/anthropic"
import { UI } from "../ui"

// Example: https://claude.ai/oauth/authorize?code=true&client_id=9d1c250a-e61b-44d9-88ed-5944d1962f5e&response_type=code&redirect_uri=https%3A%2F%2Fconsole.anthropic.com%2Foauth%2Fcode%2Fcallback&scope=org%3Acreate_api_key+user%3Aprofile+user%3Ainference&code_challenge=MdFtFgFap23AWDSN0oa3-eaKjQRFE4CaEhXx8M9fHZg&code_challenge_method=S256&state=rKLtaDzm88GSwekyEqdi0wXX-YqIr13tSzYymSzpvfs

export const LoginAnthropicCommand = {
  command: "anthropic",
  describe: "Login to Anthropic",
  handler: async () => {
    const { url, verifier } = await AuthAnthropic.authorize()

    UI.println("Login to Anthropic")
    UI.println("Open the following URL in your browser:")
    UI.println(url)
    UI.println("")

    const code = await UI.input("Paste the authorization code here: ")
    await AuthAnthropic.exchange(code, verifier)
  },
}
