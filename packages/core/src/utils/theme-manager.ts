/**
 * Service Portal Theme Manager
 * Handles automatic dependency injection into Service Portal themes
 */

import { DependencyInfo, DependencyDetector } from './dependency-detector';
import { logger } from './logger';
import inquirer from 'inquirer';
import chalk from 'chalk';

export interface ThemeUpdateOptions {
  autoPermissions?: boolean;
  skipPrompt?: boolean;
  useMinified?: boolean;
  themeId?: string;
  themeName?: string;
}

export interface ThemeInfo {
  sys_id: string;
  name: string;
  css_variables?: string;
  footer?: string;
  header?: string;
  js_includes?: string;
}

export class ServicePortalThemeManager {
  /**
   * Update Service Portal theme with dependencies
   */
  static async updateThemeWithDependencies(
    dependencies: DependencyInfo[],
    mcpTools: any,
    options: ThemeUpdateOptions = {}
  ): Promise<{success: boolean; message: string}> {
    try {
      // Step 1: Find the Service Portal theme
      logger.info('🔍 Finding Service Portal theme...');
      const theme = await this.findTheme(mcpTools, options);
      
      if (!theme) {
        return {
          success: false,
          message: '❌ No Service Portal theme found. Please specify a theme name or ID.'
        };
      }

      logger.info(`📋 Found theme: ${theme.name} (${theme.sys_id})`);

      // Step 2: Check which dependencies are missing
      const currentHeader = theme.header || '';
      const missingDeps = DependencyDetector.getMissingDependencies(
        dependencies, 
        currentHeader
      );

      if (missingDeps.length === 0) {
        logger.info('✅ All dependencies are already installed in the theme');
        return {
          success: true,
          message: 'All required dependencies are already present in the theme'
        };
      }

      // Step 3: Prompt user for confirmation (unless auto-permissions or skip prompt)
      if (!options.autoPermissions && !options.skipPrompt) {
        const shouldInstall = await this.promptForDependencies(missingDeps, theme.name);
        if (!shouldInstall) {
          return {
            success: false,
            message: 'User cancelled dependency installation'
          };
        }
      } else if (options.autoPermissions) {
        logger.info('🤖 Auto-permissions enabled - installing dependencies automatically');
      }

      // Step 4: Generate script tags
      const scriptTags = DependencyDetector.generateScriptTags(
        missingDeps, 
        options.useMinified !== false
      );

      // Step 5: Update theme header
      const updatedHeader = this.injectDependencies(currentHeader, scriptTags);

      // Step 6: Save updated theme
      logger.info('💾 Updating Service Portal theme...');
      const updateResult = await this.updateTheme(
        mcpTools,
        theme.sys_id,
        { header: updatedHeader }
      );

      if (updateResult.success) {
        const depNames = missingDeps.map(d => d.name).join(', ');
        logger.info(chalk.green(`✅ Successfully added dependencies: ${depNames}`));
        return {
          success: true,
          message: `Successfully added ${missingDeps.length} dependencies to theme "${theme.name}"`
        };
      } else {
        return {
          success: false,
          message: updateResult.message || 'Failed to update theme'
        };
      }

    } catch (error: any) {
      logger.error('❌ Error updating theme:', error);
      return {
        success: false,
        message: `Error updating theme: ${error.message}`
      };
    }
  }

  /**
   * Find Service Portal theme
   */
  private static async findTheme(
    mcpTools: any, 
    options: ThemeUpdateOptions
  ): Promise<ThemeInfo | null> {
    try {
      // If theme ID is provided, use direct lookup
      if (options.themeId) {
        const result = await mcpTools.snow_get_by_sysid({
          sys_id: options.themeId,
          table: 'sp_theme'
        });
        return result.record || null;
      }

      // Search by name or find default theme
      const searchQuery = options.themeName 
        ? `name=${options.themeName}` 
        : 'active=true^ORDERBYname';

      const result = await mcpTools.snow_find_artifact({
        query: searchQuery,
        type: 'any',
        table: 'sp_theme'
      });

      if (result.artifacts && result.artifacts.length > 0) {
        // Return first active theme or first theme found
        return result.artifacts[0];
      }

      // Try to find any theme
      const anyThemeResult = await mcpTools.snow_comprehensive_search({
        query: 'Service Portal theme'
      });

      if (anyThemeResult.results && anyThemeResult.results.length > 0) {
        const themeResult = anyThemeResult.results.find((r: any) => 
          r.sys_class_name === 'sp_theme'
        );
        return themeResult || null;
      }

      return null;
    } catch (error) {
      logger.error('Error finding theme:', error);
      return null;
    }
  }

  /**
   * Prompt user for dependency installation
   */
  private static async promptForDependencies(
    dependencies: DependencyInfo[],
    themeName: string
  ): Promise<boolean> {
    console.log('\n' + chalk.yellow('📦 Missing Dependencies Detected:'));
    
    dependencies.forEach(dep => {
      console.log(chalk.cyan(`  • ${dep.name} (${dep.version || 'latest'})`));
      console.log(chalk.gray(`    ${dep.description}`));
    });

    console.log('\n' + chalk.yellow(`These dependencies need to be added to the "${themeName}" theme.`));

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Would you like to automatically install these dependencies?',
        default: true
      }
    ]);

    return confirm;
  }

  /**
   * Inject dependencies into theme header
   */
  private static injectDependencies(currentHeader: string, scriptTags: string): string {
    // Check if header already has a dependency section
    const dependencyMarker = '<!-- Snow-Flow Dependencies -->';
    const endMarker = '<!-- End Snow-Flow Dependencies -->';

    // Create dependency section
    const dependencySection = `
${dependencyMarker}
${scriptTags}
${endMarker}`;

    // If markers exist, replace the section
    if (currentHeader.includes(dependencyMarker)) {
      const regex = new RegExp(
        `${dependencyMarker}[\\s\\S]*?${endMarker}`,
        'g'
      );
      return currentHeader.replace(regex, dependencySection);
    }

    // Otherwise, add before closing </head> or at the end
    if (currentHeader.includes('</head>')) {
      return currentHeader.replace('</head>', `${dependencySection}\n</head>`);
    }

    // Just append if no head tag
    return currentHeader + '\n' + dependencySection;
  }

  /**
   * Update theme in ServiceNow
   */
  private static async updateTheme(
    mcpTools: any,
    themeId: string,
    updates: Partial<ThemeInfo>
  ): Promise<{success: boolean; message?: string}> {
    try {
      // Use snow_edit_by_sysid to update the theme
      const result = await mcpTools.snow_edit_by_sysid({
        sys_id: themeId,
        table: 'sp_theme',
        field: 'header',
        value: updates.header
      });

      return { success: true };
    } catch (error: any) {
      return { 
        success: false, 
        message: error.message || 'Failed to update theme' 
      };
    }
  }

  /**
   * Check if widget requires dependencies and handle installation
   */
  static async handleWidgetDependencies(
    widgetConfig: any,
    mcpTools: any,
    options: ThemeUpdateOptions = {}
  ): Promise<{
    dependencies: DependencyInfo[];
    installed: boolean;
    message: string;
  }> {
    // Detect dependencies in widget
    const dependencies = DependencyDetector.analyzeWidget(widgetConfig);

    if (dependencies.length === 0) {
      return {
        dependencies: [],
        installed: true,
        message: 'No external dependencies detected'
      };
    }

    logger.info(`🔍 Detected ${dependencies.length} dependencies in widget`);

    // Update theme with dependencies
    const result = await this.updateThemeWithDependencies(
      dependencies,
      mcpTools,
      options
    );

    return {
      dependencies,
      installed: result.success,
      message: result.message
    };
  }
}