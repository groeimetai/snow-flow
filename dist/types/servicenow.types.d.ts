export interface ServicePortalWidget {
    sys_id?: string;
    name: string;
    id: string;
    template: string;
    css?: string;
    client_script?: string;
    script?: string;
    option_schema?: string;
    public?: boolean;
    roles?: string;
    data?: any;
}
export interface FlowDesignerFlow {
    sys_id?: string;
    name: string;
    description?: string;
    active: boolean;
    trigger: FlowTrigger;
    actions: FlowAction[];
    created_by?: string;
    updated_on?: string;
}
export interface FlowTrigger {
    type: 'record' | 'schedule' | 'application';
    table?: string;
    condition?: string;
    schedule?: string;
}
export interface FlowAction {
    name: string;
    type: string;
    configuration: Record<string, any>;
    order: number;
}
export interface BusinessRule {
    sys_id?: string;
    name: string;
    table: string;
    when: 'before' | 'after' | 'async' | 'display';
    insert: boolean;
    update: boolean;
    delete: boolean;
    query: boolean;
    active: boolean;
    order: number;
    condition?: string;
    script: string;
    description?: string;
}
export interface ScriptInclude {
    sys_id?: string;
    name: string;
    api_name: string;
    script: string;
    active: boolean;
    access?: 'package_private' | 'public';
    client_callable?: boolean;
    description?: string;
}
export interface UIBuilderPage {
    sys_id?: string;
    name: string;
    title: string;
    route: string;
    layout: UIBuilderLayout;
    data_resources: DataResource[];
    client_scripts: ClientStateScript[];
    parameters?: PageParameter[];
}
export interface UIBuilderLayout {
    type: 'container' | 'grid' | 'flex';
    components: UIComponent[];
    styles?: Record<string, any>;
}
export interface UIComponent {
    id: string;
    type: string;
    properties: Record<string, any>;
    children?: UIComponent[];
    events?: ComponentEvent[];
}
export interface DataResource {
    name: string;
    type: 'table' | 'script' | 'rest';
    configuration: Record<string, any>;
}
export interface ClientStateScript {
    name: string;
    script: string;
    parameters?: string[];
}
export interface PageParameter {
    name: string;
    type: string;
    required: boolean;
    default_value?: any;
}
export interface ComponentEvent {
    name: string;
    action_type: string;
    action_configuration: Record<string, any>;
}
export interface ServiceNowApplication {
    sys_id?: string;
    name: string;
    scope: string;
    version: string;
    short_description?: string;
    description?: string;
    vendor?: string;
    vendor_prefix?: string;
    active: boolean;
    tables?: ApplicationTable[];
    modules?: ApplicationModule[];
    roles?: ApplicationRole[];
}
export interface ApplicationTable {
    name: string;
    label: string;
    plural_label: string;
    extends_table?: string;
    fields: TableField[];
}
export interface TableField {
    name: string;
    label: string;
    type: string;
    max_length?: number;
    mandatory?: boolean;
    default_value?: any;
    reference?: string;
    choice_list?: Choice[];
}
export interface Choice {
    value: string;
    label: string;
    order?: number;
}
export interface ApplicationModule {
    name: string;
    title: string;
    table: string;
    view?: string;
    order: number;
    active: boolean;
    roles?: string[];
}
export interface ApplicationRole {
    name: string;
    suffix: string;
    description?: string;
    contains_roles?: string[];
}
export interface UpdateSet {
    sys_id?: string;
    name: string;
    description?: string;
    state: 'in_progress' | 'complete' | 'testing';
    application?: string;
    release_date?: string;
}
export interface ServiceNowAgentConfig {
    instance: string;
    auth: {
        type: 'basic' | 'oauth2';
        credentials: any;
    };
    updateSet?: string;
    application?: string;
}
export type ServiceNowOperation = 'widget.create' | 'widget.update' | 'widget.delete' | 'flow.create' | 'flow.update' | 'flow.execute' | 'script.create' | 'script.update' | 'ui.create' | 'ui.update' | 'app.create' | 'app.update' | 'table.create' | 'table.update';
export interface ServiceNowAPIResponse<T = any> {
    result: T;
    error?: {
        message: string;
        detail: string;
    };
}
export type AgentType = 'widget-builder' | 'workflow-designer' | 'script-generator' | 'ui-builder' | 'app-creator' | 'generic';
export interface ServiceNowConfig {
    instance: string;
    username: string;
    password: string;
    clientId?: string;
    clientSecret?: string;
}
export interface AgentTask {
    id: string;
    type: string;
    description: string;
    payload: any;
    priority: 'low' | 'medium' | 'high' | 'critical';
    dependencies?: string[];
    assignedAgent?: string;
    status?: 'pending' | 'in_progress' | 'completed' | 'failed';
}
export interface AgentResult {
    success: boolean;
    data?: any;
    error?: string;
    artifacts?: ServiceNowArtifact[];
    commands?: OrchestrationCommand[];
}
export interface ServiceNowAgent {
    id: string;
    name: string;
    type: AgentType;
    capabilities: string[];
    active: boolean;
    currentTask?: AgentTask;
}
export interface OrchestrationCommand {
    tool: string;
    parameters: any;
}
export interface ServiceNowArtifact {
    type: string;
    name: string;
    content: any;
    path?: string;
}
export interface ScopedApplication {
    sys_id?: string;
    name: string;
    scope: string;
    vendor: string;
    vendor_prefix: string;
    version: string;
    description?: string;
    active: boolean;
    private?: boolean;
    tables?: ApplicationTable[];
    menus?: ApplicationMenu[];
    roles?: ApplicationRole[];
}
export interface ApplicationMenu {
    name: string;
    label: string;
    application: string;
    modules: MenuModule[];
    order?: number;
}
export interface MenuModule {
    name: string;
    label: string;
    type: 'list' | 'form' | 'page' | 'separator';
    table?: string;
    view?: string;
    order: number;
    roles?: string[];
}
export interface UpdateSet {
    sys_id?: string;
    name: string;
    description?: string;
    state: 'in_progress' | 'complete' | 'testing';
    application?: string;
}
//# sourceMappingURL=servicenow.types.d.ts.map