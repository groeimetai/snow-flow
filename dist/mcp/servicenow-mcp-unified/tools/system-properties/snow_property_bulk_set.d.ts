/**
 * Set multiple properties at once
 * Uses official ServiceNow Table API on sys_properties
 */
export declare function snow_property_bulk_set(args: unknown): Promise<{
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
                items: {
                    type: string;
                    properties: {
                        name: {
                            type: string;
                        };
                        value: {
                            type: string;
                        };
                        description: {
                            type: string;
                        };
                        type: {
                            type: string;
                        };
                    };
                    required: string[];
                };
                description: string;
            };
        };
        required: string[];
    };
};
//# sourceMappingURL=snow_property_bulk_set.d.ts.map