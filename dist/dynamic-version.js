"use strict";
/**
 * Dynamic Version Loading
 * Loads version from package.json at runtime
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VERSION = void 0;
exports.getDynamicVersion = getDynamicVersion;
const fs_1 = require("fs");
const path_1 = require("path");
// Function to find package.json by traversing up the directory tree
function findPackageJson() {
    const possiblePaths = [
        (0, path_1.join)(__dirname, '..', 'package.json'),
        (0, path_1.join)(__dirname, '..', '..', 'package.json'),
        (0, path_1.join)(process.cwd(), 'package.json'),
        './package.json'
    ];
    for (const path of possiblePaths) {
        if ((0, fs_1.existsSync)(path)) {
            return path;
        }
    }
    return null;
}
// Get version dynamically
function getDynamicVersion() {
    try {
        const packageJsonPath = findPackageJson();
        if (packageJsonPath) {
            const packageJson = JSON.parse((0, fs_1.readFileSync)(packageJsonPath, 'utf8'));
            return packageJson.version;
        }
    }
    catch (error) {
        console.warn('Warning: Could not read version from package.json:', error);
    }
    // Fallback to hardcoded version
    return '4.1.1';
}
// Export a constant that uses the dynamic version
exports.VERSION = getDynamicVersion();
//# sourceMappingURL=dynamic-version.js.map