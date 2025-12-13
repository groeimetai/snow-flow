#!/usr/bin/env node

/**
 * Snow-Flow Stats Updater
 *
 * This script counts lines of code across all Snow-Flow repositories
 * and updates the stats.html and generates stats.json for the homepage.
 *
 * Usage: node scripts/update-stats.js
 *
 * Can be run via GitHub Actions on push/schedule for automatic updates.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const REPOS = [
    {
        name: 'snow-flow',
        path: path.resolve(__dirname, '../..'),
        color: 'cyan',
        description: 'Core MCP Servers & Tools'
    },
    {
        name: 'snow-code',
        path: path.resolve(__dirname, '../../../snow-code'),
        color: 'purple',
        description: 'CLI & Authentication'
    },
    {
        name: 'snow-flow-enterprise',
        path: path.resolve(__dirname, '../../../snow-flow-enterprise'),
        color: 'orange',
        description: 'Portal & Integrations'
    }
];

const EXTENSIONS = ['ts', 'js', 'tsx', 'jsx', 'py', 'sh', 'html', 'css', 'scss'];
const EXCLUDE_DIRS = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '__pycache__'];

/**
 * Count lines of code in a directory
 */
function countLines(repoPath) {
    if (!fs.existsSync(repoPath)) {
        console.warn(`Warning: Path does not exist: ${repoPath}`);
        return { total: 0, files: 0, byExtension: {} };
    }

    const excludePattern = EXCLUDE_DIRS.map(d => `-path "*/${d}/*"`).join(' -o ');
    const extPattern = EXTENSIONS.map(e => `-name "*.${e}"`).join(' -o ');

    try {
        // Count total lines
        const cmd = `find "${repoPath}" -type f \\( ${extPattern} \\) ! \\( ${excludePattern} \\) ! -name "package-lock.json" ! -name "*.lock" -exec wc -l {} + 2>/dev/null | tail -1`;
        const result = execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
        const total = parseInt(result.split(/\s+/)[0]) || 0;

        // Count files
        const filesCmd = `find "${repoPath}" -type f \\( ${extPattern} \\) ! \\( ${excludePattern} \\) ! -name "package-lock.json" ! -name "*.lock" 2>/dev/null | wc -l`;
        const files = parseInt(execSync(filesCmd, { encoding: 'utf-8' }).trim()) || 0;

        // Count by extension
        const byExtension = {};
        for (const ext of EXTENSIONS) {
            try {
                const extCmd = `find "${repoPath}" -name "*.${ext}" ! \\( ${excludePattern} \\) -exec wc -l {} + 2>/dev/null | tail -1`;
                const extResult = execSync(extCmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
                const extLines = parseInt(extResult.split(/\s+/)[0]) || 0;
                if (extLines > 0) {
                    byExtension[ext] = extLines;
                }
            } catch (e) {
                // Extension not found
            }
        }

        return { total, files, byExtension };
    } catch (error) {
        console.error(`Error counting lines in ${repoPath}:`, error.message);
        return { total: 0, files: 0, byExtension: {} };
    }
}

/**
 * Generate statistics
 */
function generateStats() {
    console.log('Counting lines of code...\n');

    const stats = {
        generated: new Date().toISOString(),
        generatedFormatted: new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }),
        repos: [],
        total: {
            lines: 0,
            files: 0
        }
    };

    for (const repo of REPOS) {
        console.log(`Processing ${repo.name}...`);
        const counts = countLines(repo.path);

        const repoStats = {
            name: repo.name,
            description: repo.description,
            color: repo.color,
            lines: counts.total,
            files: counts.files,
            byExtension: counts.byExtension
        };

        stats.repos.push(repoStats);
        stats.total.lines += counts.total;
        stats.total.files += counts.files;

        console.log(`  Lines: ${counts.total.toLocaleString()}`);
        console.log(`  Files: ${counts.files.toLocaleString()}`);
    }

    // Calculate percentages
    for (const repo of stats.repos) {
        repo.percentage = stats.total.lines > 0
            ? ((repo.lines / stats.total.lines) * 100).toFixed(1)
            : 0;
    }

    console.log(`\nTotal: ${stats.total.lines.toLocaleString()} lines in ${stats.total.files.toLocaleString()} files`);

    return stats;
}

/**
 * Update stats.html with new values
 */
function updateStatsHtml(stats) {
    const htmlPath = path.resolve(__dirname, '../stats.html');

    if (!fs.existsSync(htmlPath)) {
        console.warn('stats.html not found, skipping HTML update');
        return;
    }

    let html = fs.readFileSync(htmlPath, 'utf-8');

    // Update total counter target
    html = html.replace(
        /animateCounter\(document\.getElementById\('totalCounter'\),\s*\d+/g,
        `animateCounter(document.getElementById('totalCounter'), ${stats.total.lines}`
    );

    // Update individual repo counters
    const repoIdMap = {
        'snow-flow': 'snowFlowLoc',
        'snow-code': 'snowCodeLoc',
        'snow-flow-enterprise': 'enterpriseLoc'
    };

    for (const repo of stats.repos) {
        const id = repoIdMap[repo.name];
        if (id) {
            html = html.replace(
                new RegExp(`animateCounter\\(document\\.getElementById\\('${id}'\\),\\s*\\d+`, 'g'),
                `animateCounter(document.getElementById('${id}'), ${repo.lines}`
            );
        }
    }

    // Update static values in stat-value elements
    for (const repo of stats.repos) {
        // Update file counts
        html = html.replace(
            new RegExp(`(<div class="project-card ${repo.name.replace('-', '[-_]?')}[^>]*>[\\s\\S]*?Source Files<\\/span>\\s*<span class="stat-value">)\\d+`, 'g'),
            `$1${repo.files.toLocaleString()}`
        );
    }

    // Update progress bar percentages
    for (const repo of stats.repos) {
        const className = repo.name === 'snow-flow-enterprise' ? 'enterprise' : repo.name;
        html = html.replace(
            new RegExp(`(<div class="project-card ${className}[\\s\\S]*?Contribution to Total<\\/span>\\s*<span>)\\d+\\.\\d+%`, 'g'),
            `$1${repo.percentage}%`
        );
        html = html.replace(
            new RegExp(`(<div class="project-card ${className}[\\s\\S]*?data-width=")\\d+\\.\\d+`, 'g'),
            `$1${repo.percentage}`
        );
    }

    // Update total files in highlights
    html = html.replace(
        /(<div class="highlight-number">)[\d,]+(<\/div>\s*<div class="highlight-label">Source Files)/g,
        `$1${stats.total.files.toLocaleString()}$2`
    );

    // Update last updated date
    html = html.replace(
        /Last updated:.*?\|/g,
        `Last updated: ${stats.generatedFormatted} |`
    );

    fs.writeFileSync(htmlPath, html);
    console.log('\nUpdated stats.html');
}

/**
 * Write stats.json for use by other pages
 */
function writeStatsJson(stats) {
    const jsonPath = path.resolve(__dirname, '../stats.json');
    fs.writeFileSync(jsonPath, JSON.stringify(stats, null, 2));
    console.log('Generated stats.json');
}

// Main execution
const stats = generateStats();
updateStatsHtml(stats);
writeStatsJson(stats);

console.log('\nStats update complete!');
