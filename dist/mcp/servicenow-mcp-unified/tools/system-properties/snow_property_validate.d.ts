/**
 * Validate property value against its type and constraints
 * Uses official ServiceNow Table API on sys_properties
 */
export declare function snow_property_validate(args: unknown): Promise<{
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
        };
        required: string[];
    };
};
//# sourceMappingURL=snow_property_validate.d.ts.map