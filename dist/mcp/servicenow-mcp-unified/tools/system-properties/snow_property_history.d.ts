/**
 * Get audit history for a property
 * Uses official ServiceNow Table API on sys_properties and sys_audit
 */
export declare function snow_property_history(args: unknown): Promise<{
    content: {
        type: string;
        text: string;
    }[];
}>;
export declare const tool: {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            name: {
                type: string;
                description: string;
            };
            limit: {
                type: string;
                description: string;
                default: number;
            };
        };
        required: string[];
    };
};
//# sourceMappingURL=snow_property_history.d.ts.map