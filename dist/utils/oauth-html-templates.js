"use strict";
/**
 * OAuth HTML Templates with Snow-Flow branding
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OAuthTemplates = void 0;
const baseStyles = `
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
      padding: 40px;
      text-align: center;
      max-width: 500px;
      width: 100%;
    }
    .logo {
      margin-bottom: 30px;
    }
    .logo-ascii {
      font-family: 'Courier New', monospace;
      white-space: pre;
      line-height: 1.2;
      color: #4A90E2;
      font-size: 14px;
      margin-bottom: 20px;
    }
    h1 {
      color: #2E5C8A;
      margin-bottom: 20px;
      font-size: 28px;
    }
    p {
      color: #666;
      line-height: 1.6;
      margin-bottom: 15px;
    }
    .success { color: #52c41a; }
    .error { color: #f5222d; }
    .brand {
      color: #4A90E2;
      font-weight: bold;
    }
    .snowflake {
      display: inline-block;
      animation: fall 3s ease-in-out infinite;
    }
    @keyframes fall {
      0% { transform: translateY(0) rotate(0deg); }
      100% { transform: translateY(20px) rotate(360deg); }
    }
  </style>
`;
const logoASCII = `
      /\\        <span class="snowflake">❄</span>
     /  \\      <span class="snowflake" style="animation-delay: 0.5s">❄</span>
    /    \\    <span class="snowflake" style="animation-delay: 1s">❄</span>
   /      \\  <span class="snowflake" style="animation-delay: 1.5s">❄</span>
  /________\\
     ||||
`;
exports.OAuthTemplates = {
    success: `
    <html>
      <head>
        <title>Snow-Flow - Authentication Successful</title>
        ${baseStyles}
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <div class="logo-ascii">${logoASCII}</div>
            <h2 class="brand">Snow-Flow</h2>
          </div>
          <h1><span class="success">✅</span> Authentication Successful!</h1>
          <p>You are now connected to ServiceNow!</p>
          <p>You can close this window and return to the terminal.</p>
          <p style="margin-top: 30px; font-size: 14px; color: #999;">
            Snow-Flow: ServiceNow Multi-Agent Development Framework
          </p>
        </div>
      </body>
    </html>
  `,
    error: (error) => `
    <html>
      <head>
        <title>Snow-Flow - Authentication Error</title>
        ${baseStyles}
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <div class="logo-ascii">${logoASCII}</div>
            <h2 class="brand">Snow-Flow</h2>
          </div>
          <h1><span class="error">❌</span> OAuth Error</h1>
          <p>Error: ${error}</p>
          <p>Please close this window and try again.</p>
          <p style="margin-top: 30px; font-size: 14px; color: #999;">
            Need help? Check the Snow-Flow documentation.
          </p>
        </div>
      </body>
    </html>
  `,
    securityError: `
    <html>
      <head>
        <title>Snow-Flow - Security Error</title>
        ${baseStyles}
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <div class="logo-ascii">${logoASCII}</div>
            <h2 class="brand">Snow-Flow</h2>
          </div>
          <h1><span class="error">❌</span> Security Error</h1>
          <p>Invalid state parameter - possible CSRF attack detected.</p>
          <p>Please close this window and start the authentication process again.</p>
          <p style="margin-top: 30px; font-size: 14px; color: #999;">
            Your security is our priority.
          </p>
        </div>
      </body>
    </html>
  `,
    missingCode: `
    <html>
      <head>
        <title>Snow-Flow - Missing Authorization Code</title>
        ${baseStyles}
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <div class="logo-ascii">${logoASCII}</div>
            <h2 class="brand">Snow-Flow</h2>
          </div>
          <h1><span class="error">❌</span> Missing Authorization Code</h1>
          <p>No authorization code was received from ServiceNow.</p>
          <p>Please close this window and try again.</p>
          <p style="margin-top: 30px; font-size: 14px; color: #999;">
            Make sure you approve the authorization request in ServiceNow.
          </p>
        </div>
      </body>
    </html>
  `,
    tokenExchangeFailed: (error) => `
    <html>
      <head>
        <title>Snow-Flow - Token Exchange Failed</title>
        ${baseStyles}
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <div class="logo-ascii">${logoASCII}</div>
            <h2 class="brand">Snow-Flow</h2>
          </div>
          <h1><span class="error">❌</span> Token Exchange Failed</h1>
          <p>Error: ${error}</p>
          <p>Please close this window and check your OAuth configuration.</p>
          <p style="margin-top: 30px; font-size: 14px; color: #999;">
            Ensure your Client ID and Client Secret are correct.
          </p>
        </div>
      </body>
    </html>
  `
};
//# sourceMappingURL=oauth-html-templates.js.map