/**
 * Set or update a system property value
 * Uses official ServiceNow Table API on sys_properties
 */
export declare function snow_property_set(args: unknown): Promise<{
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
            value: {
                type: string;
                description: string;
            };
            description: {
                type: string;
                description: string;
            };
            type: {
                type: string;
                description: string;
                default: string;
            };
            choices: {
                type: string;
                description: string;
            };
            is_private: {
                type: string;
                description: string;
                default: boolean;
            };
            suffix: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
};
//# sourceMappingURL=snow_property_set.d.ts.map