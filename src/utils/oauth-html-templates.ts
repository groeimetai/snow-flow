/**
 * OAuth HTML Templates with Snow-Flow minimalist branding
 */

const baseStyles = `
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: #1E2531;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      color: #FFFFFF;
    }

    .container {
      max-width: 600px;
      width: 100%;
      text-align: center;
    }

    .logo {
      margin-bottom: 3rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1rem;
    }

    .logo-svg {
      width: 48px;
      height: 48px;
    }

    .logo-text {
      font-size: 2rem;
      font-weight: 800;
      letter-spacing: -0.02em;
    }

    .snow {
      color: #FFFFFF;
    }

    .flow {
      color: #00D9FF;
    }

    .status-icon {
      font-size: 4rem;
      margin-bottom: 2rem;
      display: block;
    }

    h1 {
      font-size: 3rem;
      font-weight: 800;
      line-height: 1.2;
      margin-bottom: 1.5rem;
      letter-spacing: -0.02em;
    }

    .success-text {
      color: #00D9FF;
    }

    .error-text {
      color: #f5222d;
    }

    p {
      font-size: 1.25rem;
      color: #94A3B8;
      line-height: 1.6;
      margin-bottom: 1rem;
    }

    .instruction {
      font-size: 1.125rem;
      color: #FFFFFF;
      margin-top: 2rem;
      padding: 1.5rem;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .error-details {
      margin-top: 2rem;
      padding: 1.5rem;
      background: rgba(245, 34, 45, 0.1);
      border-radius: 12px;
      border: 1px solid rgba(245, 34, 45, 0.3);
      font-family: 'Courier New', monospace;
      font-size: 0.875rem;
      color: #f5222d;
      word-break: break-word;
    }

    .footer {
      margin-top: 3rem;
      font-size: 0.875rem;
      color: #64748B;
    }

    @media (max-width: 768px) {
      h1 {
        font-size: 2rem;
      }

      .status-icon {
        font-size: 3rem;
      }

      .logo-text {
        font-size: 1.5rem;
      }
    }
  </style>
`;

const logoSVG = `
  <svg class="logo-svg" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- Mountain gradient (white to cyan) -->
      <linearGradient id="oauth-mountain" x1="16" y1="4" x2="16" y2="14" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#FFFFFF"/>
        <stop offset="100%" stop-color="#00D9FF"/>
      </linearGradient>

      <!-- Flow gradient (cyan gradient) -->
      <linearGradient id="oauth-flow" x1="16" y1="14" x2="16" y2="28" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#00E5FF"/>
        <stop offset="50%" stop-color="#00D9FF"/>
        <stop offset="100%" stop-color="#00B8D4"/>
      </linearGradient>
    </defs>

    <!-- Mountain peaks (geometric, clear) -->
    <path d="M8 14 L12 6 L16 10 L20 6 L24 14 Z"
          fill="url(#oauth-mountain)"
          stroke="#00D9FF"
          stroke-width="1"
          stroke-linejoin="round"/>

    <!-- Flowing snow stream (spiral/wave pattern) -->
    <path d="M16 14
             C18 16, 20 17, 19 19
             C18 21, 15 21, 14 23
             C13 25, 15 27, 16 28
             M16 14
             C14 16, 12 17, 13 19
             C14 21, 17 21, 18 23
             C19 25, 17 27, 16 28"
          stroke="url(#oauth-flow)"
          stroke-width="2.5"
          stroke-linecap="round"
          fill="none"
          opacity="0.9"/>

    <!-- Snow particles flowing down -->
    <circle cx="12" cy="18" r="1" fill="#00E5FF" opacity="0.6"/>
    <circle cx="20" cy="20" r="1" fill="#00D9FF" opacity="0.6"/>
    <circle cx="14" cy="24" r="0.8" fill="#00E5FF" opacity="0.5"/>
    <circle cx="18" cy="26" r="0.8" fill="#00D9FF" opacity="0.5"/>
  </svg>
`;

export const OAuthTemplates = {
  success: `
    <html>
      <head>
        <title>Snow-Flow - Authentication Successful</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        ${baseStyles}
      </head>
      <body>
        <div class="container">
          <div class="logo">
            ${logoSVG}
            <div class="logo-text">
              <span class="snow">SNOW</span><span class="flow">FLOW</span>
            </div>
          </div>

          <span class="status-icon">✓</span>

          <h1 class="success-text">
            Connected!
          </h1>

          <p>
            Your ServiceNow instance is now connected to Snow-Flow.
          </p>

          <div class="instruction">
            You can close this window and return to your terminal.
          </div>

          <div class="footer">
            Snow-Flow: ServiceNow Multi-Agent Development Framework
          </div>
        </div>
      </body>
    </html>
  `,

  error: (error: string) => `
    <html>
      <head>
        <title>Snow-Flow - Authentication Error</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        ${baseStyles}
      </head>
      <body>
        <div class="container">
          <div class="logo">
            ${logoSVG}
            <div class="logo-text">
              <span class="snow">SNOW</span><span class="flow">FLOW</span>
            </div>
          </div>

          <span class="status-icon error-text">✕</span>

          <h1 class="error-text">
            Authentication Failed
          </h1>

          <p>
            We couldn't complete the authentication process.
          </p>

          <div class="error-details">
            ${error}
          </div>

          <div class="instruction">
            Please close this window and try again.
          </div>

          <div class="footer">
            Need help? Check the Snow-Flow documentation.
          </div>
        </div>
      </body>
    </html>
  `,

  securityError: `
    <html>
      <head>
        <title>Snow-Flow - Security Error</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        ${baseStyles}
      </head>
      <body>
        <div class="container">
          <div class="logo">
            ${logoSVG}
            <div class="logo-text">
              <span class="snow">SNOW</span><span class="flow">FLOW</span>
            </div>
          </div>

          <span class="status-icon error-text">⚠</span>

          <h1 class="error-text">
            Security Error
          </h1>

          <p>
            Invalid state parameter detected - possible CSRF attack.
          </p>

          <div class="instruction">
            Please close this window and start the authentication process again.
          </div>

          <div class="footer">
            Your security is our priority.
          </div>
        </div>
      </body>
    </html>
  `,

  missingCode: `
    <html>
      <head>
        <title>Snow-Flow - Missing Authorization Code</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        ${baseStyles}
      </head>
      <body>
        <div class="container">
          <div class="logo">
            ${logoSVG}
            <div class="logo-text">
              <span class="snow">SNOW</span><span class="flow">FLOW</span>
            </div>
          </div>

          <span class="status-icon error-text">✕</span>

          <h1 class="error-text">
            Missing Authorization
          </h1>

          <p>
            No authorization code was received from ServiceNow.
          </p>

          <div class="instruction">
            Make sure you approve the authorization request in ServiceNow, then try again.
          </div>

          <div class="footer">
            Snow-Flow: ServiceNow Multi-Agent Development Framework
          </div>
        </div>
      </body>
    </html>
  `,

  tokenExchangeFailed: (error: string) => `
    <html>
      <head>
        <title>Snow-Flow - Token Exchange Failed</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        ${baseStyles}
      </head>
      <body>
        <div class="container">
          <div class="logo">
            ${logoSVG}
            <div class="logo-text">
              <span class="snow">SNOW</span><span class="flow">FLOW</span>
            </div>
          </div>

          <span class="status-icon error-text">✕</span>

          <h1 class="error-text">
            Token Exchange Failed
          </h1>

          <p>
            Unable to exchange authorization code for access token.
          </p>

          <div class="error-details">
            ${error}
          </div>

          <div class="instruction">
            Please verify your OAuth configuration (Client ID and Client Secret) and try again.
          </div>

          <div class="footer">
            Snow-Flow: ServiceNow Multi-Agent Development Framework
          </div>
        </div>
      </body>
    </html>
  `
};
