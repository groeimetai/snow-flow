#!/usr/bin/env node
/**
 * Update Set XML Packager
 * 
 * Properly packages Flow Designer XML into ServiceNow Update Sets
 * with all required metadata and escaping
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

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

export class UpdateSetXMLPackager {
  private updateSetId: string;
  private timestamp: string;
  private records: UpdateSetRecord[] = [];
  
  constructor() {
    this.updateSetId = this.generateSysId();
    this.timestamp = new Date().toISOString();
  }

  /**
   * Generate ServiceNow-compatible sys_id
   */
  private generateSysId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(value: string): string {
    if (!value) return '';
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Add a record to the update set
   */
  addRecord(record: UpdateSetRecord): void {
    this.records.push(record);
  }

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
  }): void {
    // Add flow record
    if (components.flow) {
      this.addRecord({
        table: 'sys_hub_flow',
        sys_id: components.flow.sys_id,
        action: 'INSERT_OR_UPDATE',
        payload: this.createRecordPayload('sys_hub_flow', components.flow),
        type: 'Flow Designer Flow',
        name: `sys_hub_flow_${components.flow.sys_id}`
      });
    }

    // Add snapshot
    if (components.snapshot) {
      this.addRecord({
        table: 'sys_hub_flow_snapshot',
        sys_id: components.snapshot.sys_id,
        action: 'INSERT_OR_UPDATE',
        payload: this.createRecordPayload('sys_hub_flow_snapshot', components.snapshot),
        type: 'Flow Designer Snapshot',
        name: `sys_hub_flow_snapshot_${components.snapshot.sys_id}`
      });
    }

    // Add trigger
    if (components.trigger) {
      this.addRecord({
        table: 'sys_hub_trigger_instance_v2',
        sys_id: components.trigger.sys_id,
        action: 'INSERT_OR_UPDATE',
        payload: this.createRecordPayload('sys_hub_trigger_instance_v2', components.trigger),
        type: 'Flow Designer Trigger',
        name: `sys_hub_trigger_instance_v2_${components.trigger.sys_id}`
      });
    }

    // Add actions
    components.actions?.forEach(action => {
      this.addRecord({
        table: 'sys_hub_action_instance_v2',
        sys_id: action.sys_id,
        action: 'INSERT_OR_UPDATE',
        payload: this.createRecordPayload('sys_hub_action_instance_v2', action),
        type: 'Flow Designer Action',
        name: `sys_hub_action_instance_v2_${action.sys_id}`
      });
    });

    // Add logic
    components.logic?.forEach(logic => {
      this.addRecord({
        table: 'sys_hub_flow_logic_instance_v2',
        sys_id: logic.sys_id,
        action: 'INSERT_OR_UPDATE',
        payload: this.createRecordPayload('sys_hub_flow_logic_instance_v2', logic),
        type: 'Flow Designer Logic',
        name: `sys_hub_flow_logic_instance_v2_${logic.sys_id}`
      });
    });

    // Add variables
    components.variables?.forEach(variable => {
      this.addRecord({
        table: 'sys_hub_flow_variable',
        sys_id: variable.sys_id,
        action: 'INSERT_OR_UPDATE',
        payload: this.createRecordPayload('sys_hub_flow_variable', variable),
        type: 'Flow Designer Variable',
        name: `sys_hub_flow_variable_${variable.sys_id}`
      });
    });
  }

  /**
   * Create record payload XML
   */
  private createRecordPayload(table: string, record: any): string {
    const fields = Object.entries(record)
      .filter(([key]) => !key.startsWith('_') && key !== 'sys_id')
      .map(([key, value]) => {
        if (value === null || value === undefined) {
          return `<${key}/>`;
        }
        
        // Handle display values
        const displayValue = record[`${key}_display_value`];
        const displayAttr = displayValue ? ` display_value="${this.escapeXml(displayValue)}"` : '';
        
        // Handle different value types
        if (typeof value === 'boolean') {
          return `<${key}${displayAttr}>${value}</${key}>`;
        } else if (typeof value === 'object') {
          return `<${key}${displayAttr}>${this.escapeXml(JSON.stringify(value))}</${key}>`;
        } else {
          return `<${key}${displayAttr}>${this.escapeXml(String(value))}</${key}>`;
        }
      })
      .join('');

    return `<?xml version="1.0" encoding="UTF-8"?><record_update table="${table}"><${table} action="INSERT_OR_UPDATE">${fields}<sys_id>${record.sys_id}</sys_id></${table}></record_update>`;
  }

  /**
   * Generate complete Update Set XML
   */
  generateXML(metadata: UpdateSetMetadata): string {
    const updateSetSysId = this.generateSysId();
    
    // Build update records
    const updateRecords = this.records.map(record => {
      const updateXmlSysId = this.generateSysId();
      
      return `
  <sys_update_xml action="INSERT_OR_UPDATE">
    <sys_id>${updateXmlSysId}</sys_id>
    <action>${record.action}</action>
    <application display_value="${metadata.application || 'Global'}">global</application>
    <category>${record.category || 'customer'}</category>
    <comments/>
    <name>${record.name || record.table + '_' + record.sys_id}</name>
    <payload><![CDATA[${record.payload}]]></payload>
    <remote_update_set display_value="${this.escapeXml(metadata.name)}">${updateSetSysId}</remote_update_set>
    <replace_on_upgrade>false</replace_on_upgrade>
    <source_table>${record.table}</source_table>
    <sys_class_name>sys_update_xml</sys_class_name>
    <sys_created_by>admin</sys_created_by>
    <sys_created_on>${this.timestamp}</sys_created_on>
    <sys_id>${updateXmlSysId}</sys_id>
    <sys_mod_count>0</sys_mod_count>
    <sys_recorded_at>${this.timestamp}</sys_recorded_at>
    <sys_updated_by>admin</sys_updated_by>
    <sys_updated_on>${this.timestamp}</sys_updated_on>
    <type>${record.type}</type>
    <update_domain>global</update_domain>
    <update_guid>${this.generateSysId()}${this.generateSysId()}</update_guid>
    <update_set display_value=""/>
    <view display_value="Default view">Default view</view>
  </sys_update_xml>`;
    }).join('\n');

    // Build complete XML
    return `<?xml version="1.0" encoding="UTF-8"?>
<unload unload_date="${this.timestamp}">
  <!-- Remote Update Set -->
  <sys_remote_update_set action="INSERT_OR_UPDATE">
    <sys_id>${updateSetSysId}</sys_id>
    <name>${this.escapeXml(metadata.name)}</name>
    <description>${this.escapeXml(metadata.description || '')}</description>
    <origin_sys_id>${updateSetSysId}</origin_sys_id>
    <parent/>
    <release_date>${metadata.release_date || ''}</release_date>
    <remote_parent_id/>
    <remote_sys_id>${updateSetSysId}</remote_sys_id>
    <state>${metadata.state || 'loaded'}</state>
    <summary/>
    <sys_class_name>sys_remote_update_set</sys_class_name>
    <sys_created_by>admin</sys_created_by>
    <sys_created_on>${this.timestamp}</sys_created_on>
    <sys_domain>global</sys_domain>
    <sys_domain_path>/</sys_domain_path>
    <sys_id>${updateSetSysId}</sys_id>
    <sys_mod_count>0</sys_mod_count>
    <sys_updated_by>admin</sys_updated_by>
    <sys_updated_on>${this.timestamp}</sys_updated_on>
    <update_set/>
    <update_source/>
    <version/>
  </sys_remote_update_set>

${updateRecords}
</unload>`;
  }

  /**
   * Save XML to file
   */
  saveToFile(xml: string, filename?: string): string {
    const outputDir = path.join(process.cwd(), 'flow-update-sets');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const outputFile = path.join(outputDir, filename || `update_set_${this.updateSetId}.xml`);
    fs.writeFileSync(outputFile, xml, 'utf8');
    
    return outputFile;
  }

  /**
   * Create Update Set from existing flow XML
   */
  static packageFlowXML(flowXML: string, metadata: UpdateSetMetadata): { xml: string; filePath: string } {
    const packager = new UpdateSetXMLPackager();
    
    // Parse existing XML to extract components
    // This is a simplified version - real implementation would parse properly
    const flowMatch = flowXML.match(/<sys_hub_flow[^>]*>[\s\S]*?<\/sys_hub_flow>/);
    const snapshotMatch = flowXML.match(/<sys_hub_flow_snapshot[^>]*>[\s\S]*?<\/sys_hub_flow_snapshot>/);
    
    if (flowMatch) {
      packager.addRecord({
        table: 'sys_hub_flow',
        sys_id: packager.generateSysId(),
        action: 'INSERT_OR_UPDATE',
        payload: flowMatch[0],
        type: 'Flow Designer Flow'
      });
    }
    
    if (snapshotMatch) {
      packager.addRecord({
        table: 'sys_hub_flow_snapshot',
        sys_id: packager.generateSysId(),
        action: 'INSERT_OR_UPDATE',
        payload: snapshotMatch[0],
        type: 'Flow Designer Snapshot'
      });
    }
    
    const xml = packager.generateXML(metadata);
    const filePath = packager.saveToFile(xml);
    
    return { xml, filePath };
  }

  /**
   * Validate Update Set XML structure
   */
  static validateXML(xml: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check for required elements
    if (!xml.includes('<sys_remote_update_set')) {
      errors.push('Missing sys_remote_update_set element');
    }
    
    if (!xml.includes('<sys_update_xml')) {
      errors.push('Missing sys_update_xml records');
    }
    
    // Check for proper CDATA wrapping
    const payloadMatches = xml.match(/<payload>/g);
    const cdataMatches = xml.match(/<!\[CDATA\[/g);
    if (payloadMatches && cdataMatches && payloadMatches.length !== cdataMatches.length) {
      errors.push('Payload elements not properly wrapped in CDATA');
    }
    
    // Check XML declaration
    if (!xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')) {
      errors.push('Missing or incorrect XML declaration');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Export helper function
export function packageFlowForUpdateSet(
  flowDefinition: any,
  updateSetName: string,
  description?: string
): { xml: string; filePath: string; validation: any } {
  const packager = new UpdateSetXMLPackager();
  
  // Add all flow components
  packager.addFlowComponents({
    flow: flowDefinition.flow,
    snapshot: flowDefinition.snapshot,
    trigger: flowDefinition.trigger,
    actions: flowDefinition.actions || [],
    logic: flowDefinition.logic || [],
    variables: flowDefinition.variables || []
  });
  
  // Generate XML
  const xml = packager.generateXML({
    name: updateSetName,
    description: description || `Flow deployment: ${flowDefinition.flow?.name || 'Unknown'}`
  });
  
  // Save to file
  const filePath = packager.saveToFile(xml);
  
  // Validate
  const validation = UpdateSetXMLPackager.validateXML(xml);
  
  return { xml, filePath, validation };
}

export default UpdateSetXMLPackager;