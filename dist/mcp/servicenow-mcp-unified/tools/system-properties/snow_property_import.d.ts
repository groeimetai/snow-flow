/**
 * Import system properties from JSON
 * Uses official ServiceNow Table API on sys_properties
 */
export declare function snow_property_import(args: unknown): Promise<{
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
            properties: {
                type: string;
                description: string;
            };
            overwrite: {
                type: string;
                description: string;
                default: boolean;
            };
            dry_run: {
                type: string;
                description: string;
                default: boolean;
            };
        };
        required: string[];
    };
};
//# sourceMappingURL=snow_property_import.d.ts.map