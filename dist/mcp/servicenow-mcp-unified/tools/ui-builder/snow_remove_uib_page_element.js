"use strict";
/**
 * snow_remove_uib_page_element - Remove UI Builder page elements
 *
 * Removes components from UI Builder pages with dependency validation to prevent broken references.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_remove_uib_page_element',
    description: 'Remove component from UI Builder page with dependency validation',
    // Metadata for tool discovery (not sent to LLM)
    category: 'ui-builder',
    subcategory: 'page-layout',
    use_cases: ['ui-builder', 'components', 'removal'],
    complexity: 'intermediate',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            page_id: { type: 'string', description: 'UI Builder page sys_id' },
            element_id: { type: 'string', description: 'Page element sys_id to remove' },
            force: { type: 'boolean', description: 'Force removal ignoring dependencies', default: false },
            check_dependencies: { type: 'boolean', description: 'Check for dependent elements', default: true }
        },
        required: ['page_id', 'element_id']
    }
};
async function execute(args, context) {
    const { page_id, element_id, force = false, check_dependencies = true } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Verify page exists
        const pageResponse = await client.get(`/api/now/table/sys_ux_page/${page_id}`);
        if (!pageResponse.data.result) {
            return (0, error_handler_js_1.createErrorResult)('UI Builder page not found');
        }
        // Verify element exists
        const elementResponse = await client.get(`/api/now/table/sys_ux_page_element/${element_id}`);
        if (!elementResponse.data.result) {
            return (0, error_handler_js_1.createErrorResult)('Page element not found');
        }
        const element = elementResponse.data.result;
        // Check dependencies if requested
        let dependencies = [];
        if (check_dependencies && !force) {
            dependencies = await checkElementDependencies(client, element_id, page_id);
            if (dependencies.length > 0) {
                return (0, error_handler_js_1.createErrorResult)(`Cannot remove element: ${dependencies.length} dependent element(s) found. Use force=true to override.`, { dependencies });
            }
        }
        // Remove the element
        await client.delete(`/api/now/table/sys_ux_page_element/${element_id}`);
        // Log the removal
        await client.post('/api/now/table/sys_audit', {
            tablename: 'sys_ux_page_element',
            documentkey: element_id,
            fieldname: 'deleted',
            oldvalue: 'active',
            newvalue: 'deleted',
            reason: `Element removed from page ${page_id}`
        });
        return (0, error_handler_js_1.createSuccessResult)({
            removed: true,
            element_id,
            page_id,
            element_name: element.name,
            dependencies_checked: check_dependencies,
            force_used: force
        }, { page_id, element_id });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
async function checkElementDependencies(client, elementId, pageId) {
    const dependencies = [];
    try {
        // Check for elements that reference this element
        const elementsResponse = await client.get('/api/now/table/sys_ux_page_element', {
            params: {
                sysparm_query: `page=${pageId}^parent_element=${elementId}`,
                sysparm_fields: 'sys_id,name,component'
            }
        });
        const childElements = elementsResponse.data.result || [];
        childElements.forEach((child) => {
            dependencies.push({
                type: 'child_element',
                sys_id: child.sys_id,
                name: child.name,
                component: child.component
            });
        });
        // Check for data brokers that reference this element
        const brokersResponse = await client.get('/api/now/table/sys_ux_data_broker', {
            params: {
                sysparm_query: `page=${pageId}^element=${elementId}`,
                sysparm_fields: 'sys_id,name'
            }
        });
        const brokers = brokersResponse.data.result || [];
        brokers.forEach((broker) => {
            dependencies.push({
                type: 'data_broker',
                sys_id: broker.sys_id,
                name: broker.name
            });
        });
        // Check for events that reference this element
        const eventsResponse = await client.get('/api/now/table/sys_ux_event', {
            params: {
                sysparm_query: `page=${pageId}^source_element=${elementId}`,
                sysparm_fields: 'sys_id,name,event_type'
            }
        });
        const events = eventsResponse.data.result || [];
        events.forEach((event) => {
            dependencies.push({
                type: 'event',
                sys_id: event.sys_id,
                name: event.name,
                event_type: event.event_type
            });
        });
    }
    catch (error) {
        // If we can't check dependencies, assume none exist
        console.warn('Unable to check element dependencies:', error);
    }
    return dependencies;
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_remove_uib_page_element.js.map