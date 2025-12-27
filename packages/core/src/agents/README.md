# ServiceNow Specialist Agents

This directory contains the implementation of ServiceNow specialist agents that work together through Claude Code to build, deploy, and maintain ServiceNow solutions.

## ⚠️ IMPORTANT: Flow Builder Agent Removed in v1.4.0 ⚠️

**Note**: The Flow Builder Agent and all flow-related functionality have been removed in v1.4.0 due to critical bugs. The agent file may still exist but is no longer functional. Please use ServiceNow's native Flow Designer interface directly for flow creation.

## 🤖 Available Agents

### 1. Widget Creator Agent (`widget-creator-agent.ts`)
Specializes in creating ServiceNow Service Portal widgets.

**Capabilities:**
- HTML template creation
- CSS styling and responsive design
- Client-side JavaScript development
- Server-side data processing
- Chart.js integration
- Demo data generation

**MCP Tools Used:**
- `snow_create_artifact` - Create and deploy widgets to ServiceNow
- `snow_validate_widget_coherence` - Preview widget rendering
- `snow_widget_test` - Test widget functionality

### 2. Flow Builder Agent (`flow-builder-agent.ts`)
Specializes in creating ServiceNow Flow Designer workflows.

**Capabilities:**
- Business process design
- Flow trigger configuration
- Approval workflow creation
- Integration flow building
- Error handling design

**MCP Tools Used:**
- `snow_list_flows` - Discover existing flows
- `snow_execute_flow` - Execute flows programmatically  
- `snow_get_flow_execution_status` - Monitor flow execution
- `snow_import_flow_from_xml` - Import flows from XML (only creation method)
- `snow_link_catalog_to_flow` - Link flows to catalog items

**Note:** Flow creation must be done through Flow Designer UI, not programmatically

### 3. Script Writer Agent (`script-writer-agent.ts`)
Specializes in creating ServiceNow scripts.

**Capabilities:**
- Business rule creation
- Script include development
- Client script implementation
- Scheduled job scripts
- Performance optimization

**MCP Tools Used:**
- `snow_create_script_include` - Create script includes
- `snow_create_business_rule` - Create business rules
- `snow_create_client_script` - Create client scripts

### 4. Test Agent (`test-agent.ts`)
Specializes in testing ServiceNow artifacts.

**Capabilities:**
- Test scenario creation
- Mock data generation
- Integration testing
- Performance validation
- Quality assurance

**MCP Tools Used:**
- `snow_test_flow_with_mock` - Test flows
- `snow_widget_test` - Test widgets
- `snow_comprehensive_flow_test` - Comprehensive testing
- `snow_cleanup_test_artifacts` - Clean up test data

### 5. Security Agent (`security-agent.ts`)
Specializes in ServiceNow security and compliance.

**Capabilities:**
- Security policy enforcement
- Vulnerability scanning
- Access control validation
- Compliance checking (SOX, GDPR, HIPAA)
- Security best practices

**MCP Tools Used:**
- `snow_create_access_control` - Create ACLs
- `snow_security_scan` - Security scanning
- `snow_run_compliance_scan` - Compliance validation

## 🏗️ Architecture

### Base Agent Class (`base-agent.ts`)
All agents extend the `BaseAgent` class which provides:
- Shared memory integration via SQLite
- Progress reporting to Queen Agent
- Inter-agent communication
- Error handling and logging
- Lifecycle management

### Agent Communication Pattern
```typescript
// Agents communicate through shared memory
await agent.storeArtifact(artifact);
await agent.reportProgress('Task completed', 100);
await agent.sendMessage(otherAgentId, 'coordination', data);
```

### Integration with Queen Agent
The Queen Agent uses `AgentFactory` to spawn these specialized agents:
```typescript
const agent = await agentFactory.createSpecializedAgent('widget-creator');
const result = await agent.execute(instruction, context);
```

## 🚀 Usage Examples

### Creating a Widget
```typescript
const widgetAgent = new WidgetCreatorAgent({ debugMode: true });
const result = await widgetAgent.execute(
  'Create an incident dashboard widget with real-time charts'
);
```

### Building a Flow
```typescript
const flowAgent = new FlowBuilderAgent({ debugMode: true });
const result = await flowAgent.execute(
  'Create an approval flow for catalog requests with manager approval'
);
```

### Writing a Script
```typescript
const scriptAgent = new ScriptWriterAgent({ debugMode: true });
const result = await scriptAgent.execute(
  'Create a business rule to calculate incident priority'
);
```

### Testing Artifacts
```typescript
const testAgent = new TestAgent({ debugMode: true });
const result = await testAgent.execute(
  'Test the incident dashboard widget with comprehensive scenarios'
);
```

### Security Scanning
```typescript
const securityAgent = new SecurityAgent({ debugMode: true });
const result = await securityAgent.execute(
  'Perform security scan on all recent artifacts'
);
```

## 🧪 Testing

Run the agent test suite:
```bash
npm test src/agents/test-agents.ts
```

## 📝 Best Practices

1. **Always use shared memory** for coordination between agents
2. **Report progress regularly** for long-running tasks
3. **Handle errors gracefully** and provide meaningful error messages
4. **Store artifacts** in shared memory for other agents to use
5. **Clean up resources** when agent tasks complete

## 🔄 Agent Lifecycle

1. **Initialization**: Agent is created with configuration
2. **Execution**: Agent performs its specialized task
3. **Coordination**: Agent communicates with other agents
4. **Completion**: Agent reports results and stores artifacts
5. **Cleanup**: Agent releases resources

## 🔗 MCP Tool Integration

Each agent knows which MCP tools to recommend for its tasks. The actual MCP tool execution happens through Claude Code, not directly by the agents. Agents provide:
- Tool recommendations
- Parameter preparation
- Result interpretation
- Error handling

## 🎯 Future Enhancements

- [ ] Add more specialized agents (Catalog Manager, Integration Specialist)
- [ ] Implement agent learning from past executions
- [ ] Add performance metrics collection
- [ ] Enhance inter-agent coordination protocols
- [ ] Add agent health monitoring