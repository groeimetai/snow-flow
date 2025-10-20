/**
 * Delete a system property
 * Uses official ServiceNow Table API on sys_properties
 */
export declare function snow_property_delete(args: unknown): Promise<{
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
            confirm: {
                type: string;
                description: string;
                default: boolean;
            };
        };
        required: string[];
    };
};
//# sourceMappingURL=snow_property_delete.d.ts.map