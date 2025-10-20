/**
 * Deployment Authentication Fix
 * Ensures OAuth tokens are properly refreshed and validated before deployment operations
 */
export interface AuthValidationResult {
    isValid: boolean;
    hasWriteScope: boolean;
    tokenAge?: number;
    expiresIn?: number;
    error?: string;
    recommendations?: string[];
}
export declare class DeploymentAuthManager {
    private oauth;
    private lastTokenRefresh;
    constructor();
    /**
     * Ensure we have valid tokens for deployment operations
     * This is MORE strict than regular authentication
     */
    ensureDeploymentAuth(): Promise<AuthValidationResult>;
    /**
     * Validate token by making a simple API call
     */
    private validateTokenWithAPI;
    /**
     * Check if token has write permissions by attempting to read widget table
     */
    private checkWritePermissions;
    /**
     * Force a fresh token for deployment operations
     */
    forceTokenRefresh(): Promise<{
        success: boolean;
        accessToken?: string;
        error?: string;
    }>;
    /**
     * Get fresh access token for deployment
     */
    getDeploymentToken(): Promise<string | null>;
}
//# sourceMappingURL=deployment-auth-fix.d.ts.map