#!/usr/bin/env tsx

/**
 * MCP Tools Documentation Generator
 *
 * Automatically generates documentation for all 410+ MCP tools by parsing
 * the tool definition files and extracting metadata.
 *
 * Usage:
 *   npx tsx scripts/generate-mcp-docs.ts
 *   npx tsx scripts/generate-mcp-docs.ts --dry-run  # Preview without writing files
 *
 * Output:
 *   - apps/website/src/data/mcp-tools.json - JSON data for website
 *   - docs/api/tools/*.md - Markdown documentation per category
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const TOOLS_BASE_DIR = path.join(__dirname, '../packages/core/src/mcp/servicenow-mcp-unified/tools');
const OUTPUT_JSON = path.join(__dirname, '../apps/website/src/data/mcp-tools.json');
const OUTPUT_DOCS_DIR = path.join(__dirname, '../docs/api/tools');
const DRY_RUN = process.argv.includes('--dry-run');

/**
 * Recursively find all TypeScript files in a directory
 */
function findToolFiles(dir: string): string[] {
  const files: string[] = [];

  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip migrated directories
      if (entry.name.includes('-MIGRATED')) continue;
      files.push(...findToolFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      // Skip index files and test files
      if (entry.name === 'index.ts') continue;
      if (entry.name.includes('.test.') || entry.name.includes('.spec.')) continue;
      files.push(fullPath);
    }
  }

  return files;
}

// Types
interface ToolParameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
  default?: any;
  enum?: string[];
}

interface ToolInfo {
  name: string;
  description: string;
  category: string;
  subcategory: string;
  permission: 'read' | 'write';
  allowedRoles: string[];
  complexity: string;
  frequency: string;
  useCases: string[];
  parameters: ToolParameter[];
  version: string;
  filePath: string;
}

interface CategoryInfo {
  name: string;
  displayName: string;
  description: string;
  tools: ToolInfo[];
  readCount: number;
  writeCount: number;
}

// Category display names and descriptions (EN)
const CATEGORY_META: Record<string, { displayName: string; description: string; descriptionNL: string }> = {
  'access-control': {
    displayName: 'Access Control',
    description: 'Manage ACLs, roles, and user permissions',
    descriptionNL: 'Beheer ACLs, rollen en gebruikersrechten'
  },
  'addons': {
    displayName: 'Add-ons & CI/CD',
    description: 'Instance backup, cloning, and CI/CD deployment tools',
    descriptionNL: 'Instance backup, cloning en CI/CD deployment tools'
  },
  'advanced': {
    displayName: 'Advanced AI/ML',
    description: 'AI classification, anomaly detection, and ML predictions',
    descriptionNL: 'AI classificatie, anomalie detectie en ML voorspellingen'
  },
  'applications': {
    displayName: 'Applications',
    description: 'Application scope management and installation',
    descriptionNL: 'Applicatie scope beheer en installatie'
  },
  'approvals': {
    displayName: 'Approvals',
    description: 'Approval workflows and request management',
    descriptionNL: 'Goedkeuringsworkflows en verzoekbeheer'
  },
  'asset': {
    displayName: 'Asset Management',
    description: 'Hardware and software asset lifecycle management',
    descriptionNL: 'Hardware en software asset lifecycle beheer'
  },
  'atf': {
    displayName: 'Automated Testing',
    description: 'ATF test creation, execution, and results',
    descriptionNL: 'ATF test creatie, uitvoering en resultaten'
  },
  'attachments': {
    displayName: 'Attachments',
    description: 'File attachment upload, download, and management',
    descriptionNL: 'Bestandsbijlage upload, download en beheer'
  },
  'automation': {
    displayName: 'Automation',
    description: 'Script execution, scheduled jobs, and event management',
    descriptionNL: 'Script executie, geplande taken en event beheer'
  },
  'business-rules': {
    displayName: 'Business Rules',
    description: 'Server-side business rule creation and management',
    descriptionNL: 'Server-side business rule creatie en beheer'
  },
  'catalog': {
    displayName: 'Service Catalog',
    description: 'Catalog items, categories, and ordering',
    descriptionNL: 'Catalogus items, categorieën en bestellen'
  },
  'change': {
    displayName: 'Change Management',
    description: 'Change request lifecycle and CAB management',
    descriptionNL: 'Change request lifecycle en CAB beheer'
  },
  'cmdb': {
    displayName: 'CMDB',
    description: 'Configuration item management and relationships',
    descriptionNL: 'Configuratie item beheer en relaties'
  },
  'connectors': {
    displayName: 'Connectors',
    description: 'External system connectors and integrations',
    descriptionNL: 'Externe systeem connectors en integraties'
  },
  'csm': {
    displayName: 'Customer Service',
    description: 'Customer service management and cases',
    descriptionNL: 'Klantenservice beheer en cases'
  },
  'data-management': {
    displayName: 'Data Management',
    description: 'Data import, export, and transformation',
    descriptionNL: 'Data import, export en transformatie'
  },
  'deployment': {
    displayName: 'Deployment',
    description: 'Widget, page, and artifact deployment',
    descriptionNL: 'Widget, pagina en artifact deployment'
  },
  'development': {
    displayName: 'Platform Development',
    description: 'Script includes, client scripts, and UI development',
    descriptionNL: 'Script includes, client scripts en UI development'
  },
  'devops': {
    displayName: 'DevOps',
    description: 'Pipeline management and build automation',
    descriptionNL: 'Pipeline beheer en build automatisering'
  },
  'email': {
    displayName: 'Email',
    description: 'Email notifications and templates',
    descriptionNL: 'Email notificaties en templates'
  },
  'events': {
    displayName: 'Events',
    description: 'System events and event management',
    descriptionNL: 'Systeem events en event beheer'
  },
  'flow': {
    displayName: 'Flow Designer',
    description: 'Flow and subflow creation and management',
    descriptionNL: 'Flow en subflow creatie en beheer'
  },
  'forms': {
    displayName: 'Forms',
    description: 'Form layout and configuration',
    descriptionNL: 'Formulier layout en configuratie'
  },
  'hr': {
    displayName: 'HR Service Delivery',
    description: 'HR cases and employee services',
    descriptionNL: 'HR cases en medewerker services'
  },
  'incident': {
    displayName: 'Incident Management',
    description: 'Incident creation, updates, and resolution',
    descriptionNL: 'Incident creatie, updates en oplossing'
  },
  'integration': {
    displayName: 'Integration',
    description: 'REST messages, transform maps, and import sets',
    descriptionNL: 'REST berichten, transform maps en import sets'
  },
  'knowledge': {
    displayName: 'Knowledge Management',
    description: 'Knowledge articles and bases',
    descriptionNL: 'Kennisartikelen en -bases'
  },
  'local-sync': {
    displayName: 'Local Development',
    description: 'Pull and push artifacts for local editing',
    descriptionNL: 'Pull en push artifacts voor lokaal bewerken'
  },
  'mid-server': {
    displayName: 'MID Server',
    description: 'MID Server management and monitoring',
    descriptionNL: 'MID Server beheer en monitoring'
  },
  'notifications': {
    displayName: 'Notifications',
    description: 'Push notifications and alerts',
    descriptionNL: 'Push notificaties en alerts'
  },
  'operations': {
    displayName: 'Core Operations',
    description: 'Universal table CRUD and record management',
    descriptionNL: 'Universele tabel CRUD en record beheer'
  },
  'orchestration': {
    displayName: 'Orchestration',
    description: 'Multi-system orchestration and workflows',
    descriptionNL: 'Multi-systeem orchestratie en workflows'
  },
  'platform': {
    displayName: 'Platform',
    description: 'UI pages, actions, and policies',
    descriptionNL: 'UI paginas, acties en policies'
  },
  'problem': {
    displayName: 'Problem Management',
    description: 'Problem and root cause analysis',
    descriptionNL: 'Probleem en root cause analyse'
  },
  'project': {
    displayName: 'Project Management',
    description: 'Projects, tasks, and resource management',
    descriptionNL: 'Projecten, taken en resource beheer'
  },
  'properties': {
    displayName: 'System Properties',
    description: 'System property management',
    descriptionNL: 'Systeem property beheer'
  },
  'reporting': {
    displayName: 'Reporting',
    description: 'Reports, dashboards, and KPIs',
    descriptionNL: 'Rapporten, dashboards en KPIs'
  },
  'request': {
    displayName: 'Request Management',
    description: 'Service requests and fulfillment',
    descriptionNL: 'Service requests en afhandeling'
  },
  'security': {
    displayName: 'Security',
    description: 'Security policies and compliance',
    descriptionNL: 'Security policies en compliance'
  },
  'sla': {
    displayName: 'SLA Management',
    description: 'SLA definitions and tracking',
    descriptionNL: 'SLA definities en tracking'
  },
  'transform': {
    displayName: 'Data Transform',
    description: 'Transform maps and field mapping',
    descriptionNL: 'Transform maps en veld mapping'
  },
  'ui-builder': {
    displayName: 'UI Builder',
    description: 'Now Experience UI components and pages',
    descriptionNL: 'Now Experience UI componenten en paginas'
  },
  'update-sets': {
    displayName: 'Update Sets',
    description: 'Change tracking and deployment',
    descriptionNL: 'Change tracking en deployment'
  },
  'user': {
    displayName: 'User Management',
    description: 'User accounts, groups, and roles',
    descriptionNL: 'Gebruikersaccounts, groepen en rollen'
  },
  'virtual-agent': {
    displayName: 'Virtual Agent',
    description: 'Chatbot topics and NLU training',
    descriptionNL: 'Chatbot topics en NLU training'
  },
  'widgets': {
    displayName: 'Widgets',
    description: 'Service Portal widget development',
    descriptionNL: 'Service Portal widget development'
  },
  'workflow': {
    displayName: 'Workflow',
    description: 'Legacy workflow management',
    descriptionNL: 'Legacy workflow beheer'
  },
  'workspace': {
    displayName: 'Workspace',
    description: 'Agent Workspace configuration',
    descriptionNL: 'Agent Workspace configuratie'
  }
};

/**
 * Parse tool definition from file content using regex
 */
function parseToolDefinition(content: string, filePath: string): ToolInfo | null {
  try {
    // Extract tool name
    const nameMatch = content.match(/name:\s*['"]([^'"]+)['"]/);
    if (!nameMatch) return null;
    const name = nameMatch[1];

    // Extract description
    const descMatch = content.match(/description:\s*['"]([^'"]+)['"]/);
    const description = descMatch ? descMatch[1] : '';

    // Extract category
    const categoryMatch = content.match(/category:\s*['"]([^'"]+)['"]/);
    const category = categoryMatch ? categoryMatch[1] : path.basename(path.dirname(filePath));

    // Extract subcategory
    const subcategoryMatch = content.match(/subcategory:\s*['"]([^'"]+)['"]/);
    const subcategory = subcategoryMatch ? subcategoryMatch[1] : '';

    // Extract permission
    const permissionMatch = content.match(/permission:\s*['"](\w+)['"]/);
    const permission = (permissionMatch ? permissionMatch[1] : 'read') as 'read' | 'write';

    // Extract allowedRoles
    const rolesMatch = content.match(/allowedRoles:\s*\[([^\]]+)\]/);
    const allowedRoles = rolesMatch
      ? rolesMatch[1].match(/['"]([^'"]+)['"]/g)?.map(r => r.replace(/['"]/g, '')) || []
      : ['developer', 'admin'];

    // Extract complexity
    const complexityMatch = content.match(/complexity:\s*['"](\w+)['"]/);
    const complexity = complexityMatch ? complexityMatch[1] : 'intermediate';

    // Extract frequency
    const frequencyMatch = content.match(/frequency:\s*['"](\w+)['"]/);
    const frequency = frequencyMatch ? frequencyMatch[1] : 'medium';

    // Extract use_cases
    const useCasesMatch = content.match(/use_cases:\s*\[([^\]]+)\]/);
    const useCases = useCasesMatch
      ? useCasesMatch[1].match(/['"]([^'"]+)['"]/g)?.map(u => u.replace(/['"]/g, '')) || []
      : [];

    // Extract version
    const versionMatch = content.match(/export const version\s*=\s*['"]([^'"]+)['"]/);
    const version = versionMatch ? versionMatch[1] : '1.0.0';

    // Parse input schema for parameters
    const parameters = parseInputSchema(content);

    return {
      name,
      description,
      category,
      subcategory,
      permission,
      allowedRoles,
      complexity,
      frequency,
      useCases,
      parameters,
      version,
      filePath: path.relative(TOOLS_BASE_DIR, filePath)
    };
  } catch (error) {
    console.error(`Error parsing ${filePath}:`, error);
    return null;
  }
}

/**
 * Parse input schema to extract parameters
 */
function parseInputSchema(content: string): ToolParameter[] {
  const parameters: ToolParameter[] = [];

  // Find the inputSchema block
  const schemaMatch = content.match(/inputSchema:\s*\{([\s\S]*?)\n\s*\}/);
  if (!schemaMatch) return parameters;

  const schemaContent = schemaMatch[1];

  // Find properties block
  const propertiesMatch = schemaContent.match(/properties:\s*\{([\s\S]*?)\n\s*\}/);
  if (!propertiesMatch) return parameters;

  // Find required array
  const requiredMatch = schemaContent.match(/required:\s*\[([^\]]*)\]/);
  const requiredFields = requiredMatch
    ? requiredMatch[1].match(/['"]([^'"]+)['"]/g)?.map(r => r.replace(/['"]/g, '')) || []
    : [];

  // Parse each property
  const propContent = propertiesMatch[1];
  const propRegex = /(\w+):\s*\{([^}]+)\}/g;
  let match;

  while ((match = propRegex.exec(propContent)) !== null) {
    const propName = match[1];
    const propDef = match[2];

    // Extract type
    const typeMatch = propDef.match(/type:\s*['"](\w+)['"]/);
    const type = typeMatch ? typeMatch[1] : 'string';

    // Extract description
    const descMatch = propDef.match(/description:\s*['"]([^'"]+)['"]/);
    const description = descMatch ? descMatch[1] : '';

    // Extract default
    const defaultMatch = propDef.match(/default:\s*([^,\n]+)/);
    const defaultValue = defaultMatch ? defaultMatch[1].trim() : undefined;

    // Extract enum
    const enumMatch = propDef.match(/enum:\s*\[([^\]]+)\]/);
    const enumValues = enumMatch
      ? enumMatch[1].match(/['"]([^'"]+)['"]/g)?.map(e => e.replace(/['"]/g, ''))
      : undefined;

    parameters.push({
      name: propName,
      type,
      description,
      required: requiredFields.includes(propName),
      default: defaultValue,
      enum: enumValues
    });
  }

  return parameters;
}

/**
 * Generate JSON data for the website
 */
function generateWebsiteJSON(categories: Map<string, CategoryInfo>): object {
  const data = {
    generatedAt: new Date().toISOString(),
    totalTools: 0,
    totalCategories: categories.size,
    categories: [] as any[]
  };

  for (const [categoryId, category] of categories) {
    const meta = CATEGORY_META[categoryId] || {
      displayName: categoryId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      description: `Tools for ${categoryId}`,
      descriptionNL: `Tools voor ${categoryId}`
    };

    data.categories.push({
      id: categoryId,
      name: meta.displayName,
      description: {
        en: meta.description,
        nl: meta.descriptionNL
      },
      toolCount: category.tools.length,
      readCount: category.readCount,
      writeCount: category.writeCount,
      tools: category.tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        permission: tool.permission,
        complexity: tool.complexity,
        parameters: tool.parameters.map(p => ({
          name: p.name,
          type: p.type,
          required: p.required,
          description: p.description
        }))
      }))
    });

    data.totalTools += category.tools.length;
  }

  // Sort categories alphabetically
  data.categories.sort((a, b) => a.name.localeCompare(b.name));

  return data;
}

/**
 * Generate markdown documentation for a category
 */
function generateCategoryMarkdown(categoryId: string, category: CategoryInfo): string {
  const meta = CATEGORY_META[categoryId] || {
    displayName: categoryId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    description: `Tools for ${categoryId}`
  };

  let md = `# ${meta.displayName}\n\n`;
  md += `${meta.description}\n\n`;
  md += `**Total Tools:** ${category.tools.length} | `;
  md += `**Read:** ${category.readCount} | `;
  md += `**Write:** ${category.writeCount}\n\n`;
  md += `---\n\n`;

  // Sort tools by name
  const sortedTools = [...category.tools].sort((a, b) => a.name.localeCompare(b.name));

  for (const tool of sortedTools) {
    md += `## ${tool.name}\n\n`;
    md += `${tool.description}\n\n`;

    // Metadata badges
    md += `| Property | Value |\n`;
    md += `|----------|-------|\n`;
    md += `| Permission | \`${tool.permission}\` |\n`;
    md += `| Complexity | ${tool.complexity} |\n`;
    md += `| Frequency | ${tool.frequency} |\n`;
    md += `| Allowed Roles | ${tool.allowedRoles.join(', ')} |\n\n`;

    // Parameters
    if (tool.parameters.length > 0) {
      md += `### Parameters\n\n`;
      md += `| Name | Type | Required | Description |\n`;
      md += `|------|------|----------|-------------|\n`;

      for (const param of tool.parameters) {
        const required = param.required ? '**Yes**' : 'No';
        const desc = param.description + (param.default ? ` (default: \`${param.default}\`)` : '');
        md += `| \`${param.name}\` | \`${param.type}\` | ${required} | ${desc} |\n`;
      }

      md += '\n';
    }

    // Example usage (basic)
    md += `### Example\n\n`;
    md += `\`\`\`javascript\n`;
    md += `// Using ${tool.name}\n`;
    md += `const result = await ${tool.name}({\n`;

    const requiredParams = tool.parameters.filter(p => p.required);
    for (const param of requiredParams) {
      const exampleValue = getExampleValue(param);
      md += `  ${param.name}: ${exampleValue},\n`;
    }

    md += `});\n`;
    md += `\`\`\`\n\n`;
    md += `---\n\n`;
  }

  return md;
}

/**
 * Get example value for a parameter
 */
function getExampleValue(param: ToolParameter): string {
  if (param.enum && param.enum.length > 0) {
    return `'${param.enum[0]}'`;
  }

  switch (param.type) {
    case 'string':
      if (param.name.includes('table')) return "'incident'";
      if (param.name.includes('query')) return "'active=true'";
      if (param.name.includes('sys_id')) return "'abc123...'";
      if (param.name.includes('name')) return "'example_name'";
      return "'...'";
    case 'number':
      if (param.name.includes('limit')) return '100';
      if (param.name.includes('offset')) return '0';
      return '1';
    case 'boolean':
      return 'true';
    case 'array':
      return "['field1', 'field2']";
    case 'object':
      return '{ /* ... */ }';
    default:
      return "'...'";
  }
}

/**
 * Main function
 */
async function generateDocs(): Promise<void> {
  console.log('🔍 Scanning for MCP tools...\n');

  // Find all tool files
  const toolFiles = findToolFiles(TOOLS_BASE_DIR);

  console.log(`📦 Found ${toolFiles.length} tool files\n`);

  // Parse all tools
  const categories = new Map<string, CategoryInfo>();
  let successCount = 0;
  let errorCount = 0;

  for (const filePath of toolFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const tool = parseToolDefinition(content, filePath);

    if (tool) {
      successCount++;

      // Get or create category
      if (!categories.has(tool.category)) {
        categories.set(tool.category, {
          name: tool.category,
          displayName: tool.category,
          description: '',
          tools: [],
          readCount: 0,
          writeCount: 0
        });
      }

      const category = categories.get(tool.category)!;
      category.tools.push(tool);

      if (tool.permission === 'read') {
        category.readCount++;
      } else {
        category.writeCount++;
      }
    } else {
      errorCount++;
      console.log(`  ⚠️  Could not parse: ${path.basename(filePath)}`);
    }
  }

  console.log(`\n✅ Parsed ${successCount} tools across ${categories.size} categories`);
  if (errorCount > 0) {
    console.log(`⚠️  ${errorCount} files could not be parsed\n`);
  }

  // Generate outputs
  if (DRY_RUN) {
    console.log('\n🏃 DRY RUN MODE - No files will be written\n');

    // Show sample output
    console.log('📋 Categories found:');
    for (const [id, cat] of categories) {
      console.log(`  • ${id}: ${cat.tools.length} tools (${cat.readCount} read, ${cat.writeCount} write)`);
    }

    console.log('\n💡 Run without --dry-run to generate files\n');
    return;
  }

  // Create output directories
  fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true });
  fs.mkdirSync(OUTPUT_DOCS_DIR, { recursive: true });

  // Generate website JSON
  const jsonData = generateWebsiteJSON(categories);
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(jsonData, null, 2));
  console.log(`\n✅ Generated: ${path.relative(process.cwd(), OUTPUT_JSON)}`);

  // Generate markdown docs
  let mdCount = 0;
  for (const [categoryId, category] of categories) {
    const markdown = generateCategoryMarkdown(categoryId, category);
    const mdPath = path.join(OUTPUT_DOCS_DIR, `${categoryId}.md`);
    fs.writeFileSync(mdPath, markdown);
    mdCount++;
  }
  console.log(`✅ Generated: ${mdCount} markdown files in ${path.relative(process.cwd(), OUTPUT_DOCS_DIR)}/`);

  // Generate index
  const indexMd = generateIndexMarkdown(categories);
  fs.writeFileSync(path.join(OUTPUT_DOCS_DIR, 'README.md'), indexMd);
  console.log(`✅ Generated: ${path.relative(process.cwd(), path.join(OUTPUT_DOCS_DIR, 'README.md'))}`);

  console.log('\n🎉 Documentation generation complete!\n');
}

/**
 * Generate index markdown
 */
function generateIndexMarkdown(categories: Map<string, CategoryInfo>): string {
  let totalTools = 0;
  let totalRead = 0;
  let totalWrite = 0;

  for (const cat of categories.values()) {
    totalTools += cat.tools.length;
    totalRead += cat.readCount;
    totalWrite += cat.writeCount;
  }

  let md = `# Snow-Flow MCP Tools Reference\n\n`;
  md += `Complete API reference for ${totalTools} MCP tools across ${categories.size} categories.\n\n`;
  md += `**Total Tools:** ${totalTools} | **Read:** ${totalRead} | **Write:** ${totalWrite}\n\n`;
  md += `---\n\n`;
  md += `## Categories\n\n`;

  const sortedCategories = [...categories.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  for (const [id, cat] of sortedCategories) {
    const meta = CATEGORY_META[id] || { displayName: id, description: '' };
    md += `### [${meta.displayName}](./${id}.md)\n\n`;
    md += `${meta.description}\n\n`;
    md += `**${cat.tools.length} tools** (${cat.readCount} read, ${cat.writeCount} write)\n\n`;
  }

  md += `---\n\n`;
  md += `*Generated on ${new Date().toISOString()}*\n`;

  return md;
}

// Run
generateDocs().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
