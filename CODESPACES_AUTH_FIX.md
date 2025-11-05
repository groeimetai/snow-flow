# Codespaces OAuth Fix - Feature Request for @groeimetai/snow-code

## Problem

OAuth callback flow fails in GitHub Codespaces because:
- Callback server runs on `localhost:3005` inside the Codespace
- User's browser runs on local machine
- Browser cannot reach `localhost:3005` in the remote Codespace
- Results in "Connection refused" or HTTP 502 errors

## Current Behavior

```
❌ In Codespaces:
1. snow-code auth login
2. Opens browser with auth URL
3. User approves in ServiceNow
4. Redirects to localhost:3005/callback?code=...
5. ❌ Connection refused - flow fails
```

## Proposed Solution: Codespace Detection + Manual URL Paste

**Detect Codespaces environment and adapt the flow:**

```typescript
// In snow-code auth login command

// 1. Detect if running in Codespaces
const isCodespace = !!process.env.CODESPACE_NAME;
const forwardedDomain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;

if (isCodespace && forwardedDomain) {
  // Codespaces-specific flow
  const codespace = process.env.CODESPACE_NAME;
  const forwardedUrl = `https://${codespace}-3005.${forwardedDomain}/callback`;

  console.log('🌐 Running in GitHub Codespaces');
  console.log('');
  console.log('After authentication, you will be redirected to a URL.');
  console.log('Please paste that complete URL here.');
  console.log('');
  console.log(`Expected URL format: ${forwardedUrl}?code=...`);
  console.log('');

  // Open browser with auth URL (as normal)
  await openBrowser(authUrl);

  // Wait for user to paste the redirect URL
  const redirectUrl = await promptUser('Paste the redirect URL: ');

  // Parse code from URL
  const urlParams = new URL(redirectUrl).searchParams;
  const code = urlParams.get('code');
  const state = urlParams.get('state');

  // Verify state matches
  if (state !== expectedState) {
    throw new Error('State mismatch - possible CSRF attack');
  }

  // Continue with token exchange (existing code)
  const tokens = await exchangeCodeForTokens(code);

  // Save auth (existing code)
  await saveAuth(tokens);

  console.log('✅ Authentication successful!');

} else {
  // Normal flow (localhost callback server)
  // ... existing code ...
}
```

## Implementation Details

### 1. Environment Detection

```typescript
interface CodespaceEnvironment {
  isCodespace: boolean;
  codespaceName?: string;
  forwardingDomain?: string;
  forwardedCallbackUrl?: string;
}

function detectCodespace(): CodespaceEnvironment {
  const codespaceName = process.env.CODESPACE_NAME;
  const forwardingDomain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;

  if (!codespaceName || !forwardingDomain) {
    return { isCodespace: false };
  }

  return {
    isCodespace: true,
    codespaceName,
    forwardingDomain,
    forwardedCallbackUrl: `https://${codespaceName}-3005.${forwardingDomain}/callback`
  };
}
```

### 2. URL Parsing Helper

```typescript
function parseCallbackUrl(urlString: string): { code: string; state: string } {
  try {
    const url = new URL(urlString);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (!code) {
      throw new Error('No authorization code found in URL');
    }

    return { code, state: state || '' };
  } catch (error) {
    throw new Error('Invalid URL format. Please paste the complete redirect URL.');
  }
}
```

### 3. User Prompt (using existing prompt library)

```typescript
import prompts from '@clack/prompts';

async function promptForCallbackUrl(expectedUrl: string): Promise<string> {
  const result = await prompts.text({
    message: 'Paste the redirect URL here:',
    placeholder: expectedUrl,
    validate: (value) => {
      if (!value) return 'URL is required';
      if (!value.includes('code=')) return 'URL must contain authorization code';
      return undefined;
    }
  });

  if (prompts.isCancel(result)) {
    throw new Error('Authentication cancelled');
  }

  return result as string;
}
```

## User Experience

### Normal Environment (No Changes)
```bash
$ snow-code auth login

◇  Starting ServiceNow OAuth flow
│
●  Opening browser for authentication...
│
●  Callback server started on http://localhost:3005/callback
│
●  Waiting for OAuth callback...
│
◇  ✅ Authentication successful!
```

### Codespaces (New Flow)
```bash
$ snow-code auth login

◇  Starting ServiceNow OAuth flow
│
●  🌐 Detected GitHub Codespaces environment
│
●  Opening browser for authentication...
│
●  After approving in ServiceNow, paste the redirect URL below
│
◆  Paste the redirect URL here:
│  https://username-repo-xxx-3005.app.github.dev/callback?code=ABC...&state=XYZ...
│
◇  ✅ Authentication successful!
```

## Benefits

1. ✅ **Zero user friction in normal environments** - no changes to existing flow
2. ✅ **Automatic Codespaces detection** - no manual configuration needed
3. ✅ **Secure** - still validates state parameter for CSRF protection
4. ✅ **Clear user guidance** - shows expected URL format
5. ✅ **Minimal code changes** - just one conditional branch

## Alternative Considered (Why Not Used)

**Option: Keep callback server running and handle forwarded requests**

```typescript
// This doesn't work because:
// 1. Codespaces may block or transform requests
// 2. CORS issues with forwarded domains
// 3. 502 errors indicate the server crashes on forwarded requests
// 4. More complex to debug and maintain
```

**Why manual paste is better:**
- Simple and reliable
- Works in all remote environments (not just Codespaces)
- User understands what's happening
- No network/CORS/proxy issues

## Testing Checklist

- [ ] Works in normal local environment (localhost)
- [ ] Works in GitHub Codespaces
- [ ] Works in VS Code Remote SSH
- [ ] Works in GitPod
- [ ] Works in Docker containers with port forwarding
- [ ] Validates state parameter correctly
- [ ] Shows helpful error messages for malformed URLs
- [ ] Allows cancel during URL paste prompt

## Files to Modify in @groeimetai/snow-code

```
src/commands/auth/login.ts          # Main OAuth flow logic
src/utils/environment.ts             # Codespace detection
src/utils/oauth-callback.ts          # URL parsing helpers
```

## Priority

**HIGH** - Affects all users trying to use snow-code in Codespaces, which is a common development environment.

---

## Implementation Request

Please implement this feature in @groeimetai/snow-code to enable seamless OAuth authentication in GitHub Codespaces and other remote environments.

The key is: **Detect remote environment → Prompt for URL paste → Parse code → Continue normally**

This maintains the excellent UX in normal environments while gracefully handling remote scenarios.
