import React from 'react';

function App() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>Snow-Flow Enterprise Portal</h1>
        <p style={{ fontSize: '1.25rem', color: '#666' }}>Version 2.0.0</p>
      </div>

      <div style={{ marginTop: '2rem', padding: '2rem', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
        <h2 style={{ marginTop: 0 }}>🚀 Portal Active</h2>
        <p>Welcome to the Snow-Flow Enterprise Portal. Configuration interface is under construction.</p>

        <h3 style={{ marginTop: '1.5rem' }}>Available Features:</h3>
        <ul style={{ lineHeight: '1.8' }}>
          <li><strong>Jira Integration</strong> - Bidirectional sync with advanced analytics (10 tools)</li>
          <li><strong>Azure DevOps Integration</strong> - Work item management and pipelines (8 tools)</li>
          <li><strong>Confluence Integration</strong> - Documentation sync and search (8 tools)</li>
          <li><strong>Theme Customization</strong> - Custom branding for SnowCode IDE</li>
        </ul>
      </div>

      <div style={{ marginTop: '2rem', padding: '2rem', background: '#e8f4fd', borderRadius: '8px', border: '1px solid #93c5fd' }}>
        <h3 style={{ marginTop: 0 }}>📖 Quick Start Guide</h3>
        <pre style={{
          background: '#1e293b',
          color: '#f1f5f9',
          padding: '1.5rem',
          borderRadius: '6px',
          overflow: 'auto',
          fontSize: '0.9rem',
          lineHeight: '1.6'
        }}>
{`# Install snow-flow CLI
npm install -g snow-flow

# Login with your license key
snow-flow login SF-ENT-YOUR-LICENSE-KEY

# Check authentication status
snow-flow status

# Open this portal
snow-flow portal

# Use enterprise features in development
snow-flow swarm "Sync Jira backlog to ServiceNow" --verbose

# Logout
snow-flow logout`}
        </pre>
      </div>

      <div style={{ marginTop: '2rem', padding: '2rem', background: '#fef3c7', borderRadius: '8px', border: '1px solid #fcd34d' }}>
        <h3 style={{ marginTop: 0 }}>🔧 MCP Server Status</h3>
        <p>Enterprise MCP server is running at:</p>
        <code style={{ background: '#fff', padding: '0.5rem 1rem', borderRadius: '4px', display: 'inline-block' }}>
          https://enterprise.snow-flow.dev/mcp/sse
        </code>
        <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#92400e' }}>
          <strong>Note:</strong> 26 enterprise tools available after authentication
        </p>
      </div>

      <div style={{ marginTop: '3rem', textAlign: 'center', color: '#666', fontSize: '0.875rem' }}>
        <p>Snow-Flow Enterprise • Portal v2.0.0 • MCP Server Active</p>
        <p>
          <a href="https://github.com/groeimetai/snow-flow" style={{ color: '#2563eb', textDecoration: 'none' }}>
            GitHub (Open Source)
          </a>
          {' • '}
          <a href="https://www.npmjs.com/package/snow-flow" style={{ color: '#2563eb', textDecoration: 'none' }}>
            npm Package
          </a>
        </p>
      </div>
    </div>
  );
}

export default App;
