/**
 * Snow-Flow Enterprise Portal - Backend
 *
 * Express server serving React frontend + REST APIs
 * - Authentication (login, validate, logout)
 * - Credentials management (Jira, Azure DevOps, Confluence)
 * - Theme management
 * - SSO configuration
 * - Monitoring and analytics
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'snow-flow-portal',
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

// API routes (placeholder - to be implemented)
app.get('/api/status', (req, res) => {
  res.json({ message: 'Portal API is running' });
});

// Serve React frontend (built files)
const frontendPath = path.join(__dirname, '..', '..', 'frontend', 'dist');
app.use(express.static(frontendPath));

// SPA fallback - serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Snow-Flow Portal running on port ${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
  console.log(`🌐 Frontend: http://localhost:${PORT}`);
});
