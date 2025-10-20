"use strict";
/**
 * Service Portal Theme Manager
 * Handles automatic dependency injection into Service Portal themes
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServicePortalThemeManager = void 0;
const dependency_detector_1 = require("./dependency-detector");
const logger_1 = require("./logger");
const inquirer_1 = __importDefault(require("inquirer"));
const chalk_1 = __importDefault(require("chalk"));
class ServicePortalThemeManager {
    /**
     * Update Service Portal theme with dependencies
     */
    static async updateThemeWithDependencies(dependencies, mcpTools, options = {}) {
        try {
            // Step 1: Find the Service Portal theme
            logger_1.logger.info('🔍 Finding Service Portal theme...');
            const theme = await this.findTheme(mcpTools, options);
            if (!theme) {
                return {
                    success: false,
                    message: '❌ No Service Portal theme found. Please specify a theme name or ID.'
                };
            }
            logger_1.logger.info(`📋 Found theme: ${theme.name} (${theme.sys_id})`);
            // Step 2: Check which dependencies are missing
            const currentHeader = theme.header || '';
            const missingDeps = dependency_detector_1.DependencyDetector.getMissingDependencies(dependencies, currentHeader);
            if (missingDeps.length === 0) {
                logger_1.logger.info('✅ All dependencies are already installed in the theme');
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
            }
            else if (options.autoPermissions) {
                logger_1.logger.info('🤖 Auto-permissions enabled - installing dependencies automatically');
            }
            // Step 4: Generate script tags
            const scriptTags = dependency_detector_1.DependencyDetector.generateScriptTags(missingDeps, options.useMinified !== false);
            // Step 5: Update theme header
            const updatedHeader = this.injectDependencies(currentHeader, scriptTags);
            // Step 6: Save updated theme
            logger_1.logger.info('💾 Updating Service Portal theme...');
            const updateResult = await this.updateTheme(mcpTools, theme.sys_id, { header: updatedHeader });
            if (updateResult.success) {
                const depNames = missingDeps.map(d => d.name).join(', ');
                logger_1.logger.info(chalk_1.default.green(`✅ Successfully added dependencies: ${depNames}`));
                return {
                    success: true,
                    message: `Successfully added ${missingDeps.length} dependencies to theme "${theme.name}"`
                };
            }
            else {
                return {
                    success: false,
                    message: updateResult.message || 'Failed to update theme'
                };
            }
        }
        catch (error) {
            logger_1.logger.error('❌ Error updating theme:', error);
            return {
                success: false,
                message: `Error updating theme: ${error.message}`
            };
        }
    }
    /**
     * Find Service Portal theme
     */
    static async findTheme(mcpTools, options) {
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
                const themeResult = anyThemeResult.results.find((r) => r.sys_class_name === 'sp_theme');
                return themeResult || null;
            }
            return null;
        }
        catch (error) {
            logger_1.logger.error('Error finding theme:', error);
            return null;
        }
    }
    /**
     * Prompt user for dependency installation
     */
    static async promptForDependencies(dependencies, themeName) {
        console.log('\n' + chalk_1.default.yellow('📦 Missing Dependencies Detected:'));
        dependencies.forEach(dep => {
            console.log(chalk_1.default.cyan(`  • ${dep.name} (${dep.version || 'latest'})`));
            console.log(chalk_1.default.gray(`    ${dep.description}`));
        });
        console.log('\n' + chalk_1.default.yellow(`These dependencies need to be added to the "${themeName}" theme.`));
        const { confirm } = await inquirer_1.default.prompt([
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
    static injectDependencies(currentHeader, scriptTags) {
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
            const regex = new RegExp(`${dependencyMarker}[\\s\\S]*?${endMarker}`, 'g');
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
    static async updateTheme(mcpTools, themeId, updates) {
        try {
            // Use snow_edit_by_sysid to update the theme
            const result = await mcpTools.snow_edit_by_sysid({
                sys_id: themeId,
                table: 'sp_theme',
                field: 'header',
                value: updates.header
            });
            return { success: true };
        }
        catch (error) {
            return {
                success: false,
                message: error.message || 'Failed to update theme'
            };
        }
    }
    /**
     * Check if widget requires dependencies and handle installation
     */
    static async handleWidgetDependencies(widgetConfig, mcpTools, options = {}) {
        // Detect dependencies in widget
        const dependencies = dependency_detector_1.DependencyDetector.analyzeWidget(widgetConfig);
        if (dependencies.length === 0) {
            return {
                dependencies: [],
                installed: true,
                message: 'No external dependencies detected'
            };
        }
        logger_1.logger.info(`🔍 Detected ${dependencies.length} dependencies in widget`);
        // Update theme with dependencies
        const result = await this.updateThemeWithDependencies(dependencies, mcpTools, options);
        return {
            dependencies,
            installed: result.success,
            message: result.message
        };
    }
}
exports.ServicePortalThemeManager = ServicePortalThemeManager;
//# sourceMappingURL=theme-manager.js.map