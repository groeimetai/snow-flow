/**
 * Export system properties to JSON format
 * Uses official ServiceNow Table API on sys_properties
 */
export declare function snow_property_export(args: unknown): Promise<{
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
            pattern: {
                type: string;
                description: string;
            };
            include_system: {
                type: string;
                description: string;
                default: boolean;
            };
            include_private: {
                type: string;
                description: string;
                default: boolean;
            };
        };
    };
};
//# sourceMappingURL=snow_property_export.d.ts.map