/**
 * Get multiple properties at once
 * Uses official ServiceNow Table API on sys_properties
 */
export declare function snow_property_bulk_get(args: unknown): Promise<{
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
            names: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            include_metadata: {
                type: string;
                description: string;
                default: boolean;
            };
        };
        required: string[];
    };
};
//# sourceMappingURL=snow_property_bulk_get.d.ts.map