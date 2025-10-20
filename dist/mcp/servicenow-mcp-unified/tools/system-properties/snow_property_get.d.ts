/**
 * Get a system property value by name
 * Uses official ServiceNow Table API on sys_properties
 */
export declare function snow_property_get(args: unknown): Promise<{
    content: {
        type: string;
        text: any;
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
            include_metadata: {
                type: string;
                description: string;
                default: boolean;
            };
        };
        required: string[];
    };
};
//# sourceMappingURL=snow_property_get.d.ts.map