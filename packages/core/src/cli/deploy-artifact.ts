#!/usr/bin/env node
/**
 * Generic Artifact Deployer
 * Deploy any ServiceNow artifact type dynamically
 */

import { Command } from 'commander';
import { ServiceNowClient } from '../utils/servicenow-client.js';
import { ServiceNowOAuth } from '../utils/snow-oauth.js';
import { Logger } from '../utils/logger.js';
import { promises as fs } from 'fs';
import chalk from 'chalk';

const logger = new Logger('DeployArtifact');

interface ArtifactConfig {
  type: 'widget' | 'flow' | 'script_include' | 'business_rule' | 'application' | 'table';
  name: string;
  description?: string;
  config: Record<string, any>;
  template?: string;
}

async function deployArtifact(type: string, configPath: string) {
  try {
    logger.info(`Deploying ${type} artifact from ${configPath}`);

    // Load configuration
    const configContent = await fs.readFile(configPath, 'utf-8');
    const config: ArtifactConfig = JSON.parse(configContent);

    // Validate configuration
    if (!config.name) {
      throw new Error('Artifact name is required in configuration');
    }

    // Check authentication
    const oauth = new ServiceNowOAuth();
    const isAuth = await oauth.isAuthenticated();
    if (!isAuth) {
      throw new Error('Not authenticated. Run "snow-flow auth login" first.');
    }

    // Create client
    const client = new ServiceNowClient();

    // Deploy based on type
    let result;
    switch (type) {
      case 'widget':
        result = await deployWidget(client, config);
        break;
      case 'flow':
        result = await deployFlow(client, config);
        break;
      case 'script_include':
        result = await deployScriptInclude(client, config);
        break;
      case 'business_rule':
        result = await deployBusinessRule(client, config);
        break;
      case 'application':
        result = await deployApplication(client, config);
        break;
      case 'table':
        result = await deployTable(client, config);
        break;
      default:
        throw new Error(`Unsupported artifact type: ${type}`);
    }

    // Display result
    if (result.success) {
      console.log(chalk.green('\n✅ Deployment successful!'));
      console.log(chalk.blue(`\n📋 Artifact Details:`));
      console.log(`   Name: ${config.name}`);
      console.log(`   Type: ${type}`);
      console.log(`   Sys ID: ${result.data?.sys_id}`);
      
      const credentials = await oauth.loadCredentials();
      console.log(chalk.yellow(`\n🔗 View in ServiceNow:`));
      console.log(`   ${getArtifactUrl(credentials?.instance || '', type, result.data?.sys_id)}`);
    } else {
      throw new Error(result.error || 'Deployment failed');
    }

  } catch (error) {
    logger.error('Deployment failed', error);
    console.error(chalk.red(`\n❌ Error: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }
}

async function deployWidget(client: ServiceNowClient, config: ArtifactConfig) {
  return await client.createWidget({
    name: config.name,
    id: config.config.id || config.name.toLowerCase().replace(/\s+/g, '_'),
    title: config.config.title || config.name,
    description: config.description || '',
    template: config.config.template || '',
    css: config.config.css || '',
    client_script: config.config.client_script || '',
    script: config.config.script || '', // ServiceNow uses 'script' field
    option_schema: config.config.option_schema || '[]',
    demo_data: config.config.demo_data || '{}',
    has_preview: config.config.has_preview || false,
    category: config.config.category || 'custom'
  });
}

async function deployFlow(client: ServiceNowClient, config: ArtifactConfig) {
  return await client.createFlow({
    name: config.name,
    description: config.description || '',
    active: config.config.active !== false,
    table: config.config.table || '',
    trigger_type: config.config.trigger_type || 'manual',
    condition: config.config.condition || '',
    flow_definition: JSON.stringify(config.config.flow_definition || {}),
    category: config.config.category || 'automation'
  });
}

async function deployScriptInclude(client: ServiceNowClient, config: ArtifactConfig) {
  return await client.createScriptInclude({
    name: config.name,
    api_name: config.config.api_name || config.name,
    description: config.description || '',
    script: config.config.script || '',
    active: config.config.active !== false,
    access: config.config.access || 'public'
  });
}

async function deployBusinessRule(client: ServiceNowClient, config: ArtifactConfig) {
  return await client.createBusinessRule({
    name: config.name,
    table: config.config.table || 'incident',
    when: config.config.when || 'after',
    condition: config.config.condition || '',
    script: config.config.script || '',
    description: config.description || '',
    active: config.config.active !== false,
    order: config.config.order || 100
  });
}

async function deployApplication(client: ServiceNowClient, config: ArtifactConfig) {
  return await client.createApplication({
    name: config.name,
    scope: config.config.scope || 'x_' + config.name.toLowerCase().replace(/\s+/g, '_'),
    version: config.config.version || '1.0.0',
    short_description: config.config.short_description || config.description || '',
    description: config.description || '',
    vendor: config.config.vendor || 'Custom',
    vendor_prefix: config.config.vendor_prefix || 'x',
    active: config.config.active !== false
  });
}

async function deployTable(client: ServiceNowClient, config: ArtifactConfig) {
  return await client.createTable({
    name: config.name,
    label: config.config.label || config.name,
    extends_table: config.config.extends_table || 'sys_metadata',
    is_extendable: config.config.is_extendable !== false,
    access: config.config.access || 'public',
    create_access_controls: config.config.create_access_controls !== false
  });
}

function getArtifactUrl(instance: string, type: string, sysId: string): string {
  const baseUrl = `https://${instance}`;
  switch (type) {
    case 'widget':
      return `${baseUrl}/sp_config?id=widget_editor&sys_id=${sysId}`;
    case 'flow':
      return `${baseUrl}/flow-designer/flow/${sysId}`;
    case 'script_include':
      return `${baseUrl}/sys_script_include.do?sys_id=${sysId}`;
    case 'business_rule':
      return `${baseUrl}/sys_script.do?sys_id=${sysId}`;
    case 'application':
      return `${baseUrl}/sys_app.do?sys_id=${sysId}`;
    case 'table':
      return `${baseUrl}/sys_db_object.do?sys_id=${sysId}`;
    default:
      return baseUrl;
  }
}

// CLI setup
const program = new Command();

program
  .name('deploy-artifact')
  .description('Deploy any ServiceNow artifact type dynamically')
  .version('1.0.0');

program
  .command('deploy')
  .description('Deploy an artifact from configuration file')
  .requiredOption('-t, --type <type>', 'Artifact type (widget, flow, script_include, business_rule, application, table)')
  .requiredOption('-c, --config <path>', 'Path to artifact configuration file (JSON)')
  .action(async (options) => {
    await deployArtifact(options.type, options.config);
  });

program
  .command('template')
  .description('Generate a template configuration file')
  .requiredOption('-t, --type <type>', 'Artifact type')
  .requiredOption('-o, --output <path>', 'Output file path')
  .action(async (options) => {
    const template = getTemplate(options.type);
    await fs.writeFile(options.output, JSON.stringify(template, null, 2));
    console.log(chalk.green(`✅ Template created: ${options.output}`));
  });

function getTemplate(type: string): any {
  const templates: Record<string, any> = {
    widget: {
      type: 'widget',
      name: 'My Custom Widget',
      description: 'A custom ServiceNow widget',
      config: {
        title: 'My Widget',
        category: 'custom',
        template: '<div>{{c.data.message}}</div>',
        css: '.my-widget { padding: 20px; }',
        client_script: 'function() { var c = this; c.data.message = "Hello World"; }',
        script: '(function() { data.message = "Server message"; })()', // ServiceNow uses 'script' field
        option_schema: '[]',
        demo_data: '{}'
      }
    },
    flow: {
      type: 'flow',
      name: 'My Custom Flow',
      description: 'A custom ServiceNow flow',
      config: {
        table: 'incident',
        trigger_type: 'record_created',
        condition: 'active=true',
        category: 'automation',
        flow_definition: {
          activities: [],
          variables: []
        }
      }
    },
    script_include: {
      type: 'script_include',
      name: 'MyUtilityClass',
      description: 'Utility functions',
      config: {
        api_name: 'MyUtilityClass',
        script: 'var MyUtilityClass = Class.create();\nMyUtilityClass.prototype = {\n    initialize: function() {},\n    type: "MyUtilityClass"\n};',
        access: 'public'
      }
    },
    business_rule: {
      type: 'business_rule',
      name: 'My Business Rule',
      description: 'A custom business rule',
      config: {
        table: 'incident',
        when: 'before',
        condition: '',
        script: '(function executeRule(current, previous) {\n    // Business rule logic here\n})(current, previous);',
        active: true,
        order: 100
      }
    },
    application: {
      type: 'application',
      name: 'My Custom Application',
      description: 'A custom ServiceNow application',
      config: {
        scope: 'x_custom',
        version: '1.0.0',
        vendor: 'Custom',
        vendor_prefix: 'x',
        active: true
      }
    },
    table: {
      type: 'table',
      name: 'u_custom_table',
      description: 'A custom ServiceNow table',
      config: {
        label: 'Custom Table',
        extends_table: 'task',
        is_extendable: true,
        access: 'public',
        create_access_controls: true
      }
    }
  };

  return templates[type] || { type, name: 'New Artifact', config: {} };
}

program.parse(process.argv);