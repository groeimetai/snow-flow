/**
 * List system properties with optional filtering
 * Uses official ServiceNow Table API on sys_properties
 */
export declare function snow_property_list(args: unknown): Promise<{
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
            category: {
                type: string;
                description: string;
            };
            is_private: {
                type: string;
                description: string;
            };
            limit: {
                type: string;
                description: string;
                default: number;
            };
            include_values: {
                type: string;
                description: string;
                default: boolean;
            };
        };
    };
};
//# sourceMappingURL=snow_property_list.d.ts.map