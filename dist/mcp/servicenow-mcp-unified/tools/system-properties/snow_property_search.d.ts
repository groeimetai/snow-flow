/**
 * Search properties by name or value content
 * Uses official ServiceNow Table API on sys_properties
 */
export declare function snow_property_search(args: unknown): Promise<{
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
            search_term: {
                type: string;
                description: string;
            };
            search_in: {
                type: string;
                enum: string[];
                description: string;
                default: string;
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
//# sourceMappingURL=snow_property_search.d.ts.map