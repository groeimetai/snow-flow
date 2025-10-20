/**
 * List all property categories
 * Uses official ServiceNow Table API on sys_properties
 */
export declare function snow_property_categories(args: unknown): Promise<{
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
            include_counts: {
                type: string;
                description: string;
                default: boolean;
            };
        };
    };
};
//# sourceMappingURL=snow_property_categories.d.ts.map