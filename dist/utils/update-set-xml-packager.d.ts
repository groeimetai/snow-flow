#!/usr/bin/env node
/**
 * Update Set XML Packager
 *
 * Properly packages Flow Designer XML into ServiceNow Update Sets
 * with all required metadata and escaping
 */
export interface UpdateSetMetadata {
    name: string;
    description?: string;
    application?: string;
    release_date?: string;
    state?: 'loaded' | 'previewed' | 'committed';
}
export interface UpdateSetRecord {
    table: string;
    sys_id: string;
    action: 'INSERT_OR_UPDATE' | 'DELETE';
    payload: string;
    type: string;
    name?: string;
    category?: string;
}
export declare class UpdateSetXMLPackager {
    private updateSetId;
    private timestamp;
    private records;
    constructor();
    /**
     * Generate ServiceNow-compatible sys_id
     */
    private generateSysId;
    /**
     * Escape XML special characters
     */
    private escapeXml;
    /**
     * Add a record to the update set
     */
    addRecord(record: UpdateSetRecord): void;
    /**
     * Add flow components to update set
     */
    addFlowComponents(components: {
        flow: any;
        snapshot: any;
        trigger: any;
        actions: any[];
        logic: any[];
        variables?: any[];
    }): void;
    /**
     * Create record payload XML
     */
    private createRecordPayload;
    /**
     * Generate complete Update Set XML
     */
    generateXML(metadata: UpdateSetMetadata): string;
    /**
     * Save XML to file
     */
    saveToFile(xml: string, filename?: string): string;
    /**
     * Create Update Set from existing flow XML
     */
    static packageFlowXML(flowXML: string, metadata: UpdateSetMetadata): {
        xml: string;
        filePath: string;
    };
    /**
     * Validate Update Set XML structure
     */
    static validateXML(xml: string): {
        valid: boolean;
        errors: string[];
    };
}
export declare function packageFlowForUpdateSet(flowDefinition: any, updateSetName: string, description?: string): {
    xml: string;
    filePath: string;
    validation: any;
};
export default UpdateSetXMLPackager;
//# sourceMappingURL=update-set-xml-packager.d.ts.map