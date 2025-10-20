"use strict";
/**
 * SPARC Team Executor - Redirects to Working Functionality
 * Provides helpful guidance to users who try SPARC commands
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeamSparcExecutor = void 0;
class TeamSparcExecutor {
    static async execute(teamType, task, options = {}) {
        console.log(`\n🎯 SPARC Team: ${teamType.toUpperCase()}`);
        console.log(`📋 Task: ${task}\n`);
        // Determine the best swarm strategy based on team type
        const strategyMap = {
            'widget': 'development',
            'flow': 'development',
            'app': 'development',
            'application': 'development',
            'adaptive': '_analysis'
        };
        const strategy = strategyMap[teamType.toLowerCase()] || 'development';
        const swarmCommand = `snow-flow swarm "${task}"${strategy !== 'development' ? ` --strategy ${strategy}` : ''}${options.parallel ? ' --parallel' : ''}${options.monitor ? ' --monitor' : ''}`;
        console.log(`✅ SPARC Team functionality is available through the SWARM system!\n`);
        console.log(`🚀 Run this command instead:\n`);
        console.log(`   ${swarmCommand}\n`);
        console.log(`💡 The SWARM system provides:`);
        console.log(`   • Multi-agent team coordination (what SPARC was designed for)`);
        console.log(`   • Specialist role assignment automatically`);
        console.log(`   • Real-time progress monitoring`);
        console.log(`   • Direct ServiceNow integration\n`);
        console.log(`📚 For more options: snow-flow swarm --help`);
        console.log(`🆘 For detailed help: snow-flow sparc-help\n`);
        return {
            success: true,
            message: 'SPARC functionality redirected to working SWARM system',
            teamType,
            task,
            options,
            recommendedCommand: swarmCommand,
            redirectedTo: 'swarm'
        };
    }
    static async executeSpecialist(specialistType, task, options = {}) {
        console.log(`\n👨‍💻 SPARC ${specialistType.toUpperCase()} Specialist`);
        console.log(`📋 Task: ${task}\n`);
        // Map specialist types to swarm strategies
        const specialistStrategyMap = {
            'frontend': 'development',
            'backend': 'development',
            'security': '_analysis',
            'database': 'development',
            'process': 'development',
            'trigger': 'development',
            'data': '_analysis',
            'logic': 'development',
            'interface': 'development',
            'uiux': 'development',
            'platform': 'development'
        };
        const strategy = specialistStrategyMap[specialistType.toLowerCase()] || 'development';
        const swarmCommand = `snow-flow swarm "${task}" --strategy ${strategy}${options.monitor ? ' --monitor' : ''}${options.dryRun ? ' --dry-run' : ''}`;
        console.log(`✅ SPARC Specialist functionality is available through the SWARM system!\n`);
        console.log(`🚀 Run this command instead:\n`);
        console.log(`   ${swarmCommand}\n`);
        console.log(`💡 The SWARM system automatically:`);
        console.log(`   • Spawns ${specialistType} specialists when needed`);
        console.log(`   • Coordinates with other specialists automatically`);
        console.log(`   • Provides real-time progress monitoring`);
        console.log(`   • Integrates directly with ServiceNow\n`);
        console.log(`📚 For more options: snow-flow swarm --help`);
        console.log(`🆘 For detailed help: snow-flow sparc-help\n`);
        return {
            success: true,
            message: 'SPARC specialist functionality redirected to working SWARM system',
            specialistType,
            task,
            options,
            recommendedCommand: swarmCommand,
            redirectedTo: 'swarm'
        };
    }
}
exports.TeamSparcExecutor = TeamSparcExecutor;
//# sourceMappingURL=team-sparc.js.map