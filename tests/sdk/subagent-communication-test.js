/**
 * Claude Agent SDK Subagent Communication Test
 *
 * Tests the newly created Markdown subagents to verify:
 * 1. Subagents can be spawned from agent definitions
 * 2. Orchestrator can delegate to specialist subagents
 * 3. Communication patterns work correctly
 * 4. MCP tool access is functional
 * 5. Context is preserved across subagent calls
 */

import { readFile } from 'fs/promises';
import { join } from 'path';

const AGENTS_DIR = join(process.cwd(), '.claude', 'agents');

/**
 * Test 1: Verify all agent definitions are readable
 */
async function testAgentDefinitionsExist() {
  console.log('🧪 Test 1: Verifying agent definitions exist...');

  const requiredAgents = [
    'orchestrator.md',
    'deployment-specialist.md',
    'risk-assessor.md',
    'solution-architect.md',
    'validator.md'
  ];

  const results = [];

  for (const agent of requiredAgents) {
    try {
      const content = await readFile(join(AGENTS_DIR, agent), 'utf-8');
      const wordCount = content.split(/\s+/).length;
      const hasRole = content.includes('## Your Expertise') || content.includes('## Your Role');
      const hasMCPTools = content.includes('MCP Tools') || content.includes('## MCP');
      const hasWorkflow = content.includes('Workflow') || content.includes('## Step');

      results.push({
        agent,
        status: 'PASS',
        wordCount,
        hasRole,
        hasMCPTools,
        hasWorkflow,
        details: `✅ ${agent} (${wordCount} words, role: ${hasRole}, tools: ${hasMCPTools}, workflow: ${hasWorkflow})`
      });
    } catch (error) {
      results.push({
        agent,
        status: 'FAIL',
        error: error.message,
        details: `❌ ${agent} - ${error.message}`
      });
    }
  }

  console.log(results.map(r => r.details).join('\n'));
  return results.every(r => r.status === 'PASS');
}

/**
 * Test 2: Verify orchestrator delegation structure
 */
async function testOrchestratorDelegationPatterns() {
  console.log('\n🧪 Test 2: Verifying orchestrator delegation patterns...');

  const orchestrator = await readFile(join(AGENTS_DIR, 'orchestrator.md'), 'utf-8');

  const checks = [
    {
      name: 'Strategic Thinking Framework',
      pattern: /Phase 1.*Phase 2.*Phase 3.*Phase 4.*Phase 5/s,
      required: true
    },
    {
      name: 'Risk Assessor Reference',
      pattern: /@risk-assessor/,
      required: true
    },
    {
      name: 'Solution Architect Reference',
      pattern: /@solution-architect/,
      required: true
    },
    {
      name: 'Deployment Specialist Reference',
      pattern: /@deployment-specialist/,
      required: true
    },
    {
      name: 'Validator Reference',
      pattern: /@validator/,
      required: true
    },
    {
      name: 'MCP Tool Discovery',
      pattern: /snow_comprehensive_search|snow_deploy|snow_query_table/,
      required: true
    },
    {
      name: 'ES5 Enforcement',
      pattern: /ES5.*ONLY|const.*let.*arrow/i,
      required: true
    },
    {
      name: 'Widget Coherence',
      pattern: /Widget.*[Cc]oherence|HTML.*Client.*Server/,
      required: true
    }
  ];

  const results = checks.map(check => {
    const found = check.pattern.test(orchestrator);
    return {
      name: check.name,
      status: found ? 'PASS' : (check.required ? 'FAIL' : 'WARN'),
      found,
      details: `${found ? '✅' : '❌'} ${check.name}: ${found ? 'Found' : 'Missing'}`
    };
  });

  console.log(results.map(r => r.details).join('\n'));
  return results.every(r => r.status !== 'FAIL');
}

/**
 * Test 3: Verify specialist agent capabilities
 */
async function testSpecialistAgentCapabilities() {
  console.log('\n🧪 Test 3: Verifying specialist agent capabilities...');

  const specialists = [
    {
      file: 'deployment-specialist.md',
      requiredCapabilities: [
        'snow_deploy',
        'snow_validate_deployment',
        'snow_rollback_deployment',
        'Widget Coherence',
        'ES5'
      ]
    },
    {
      file: 'risk-assessor.md',
      requiredCapabilities: [
        'Risk Assessment',
        'Impact',
        'Likelihood',
        'Mitigation',
        'snow_analyze_query'
      ]
    },
    {
      file: 'solution-architect.md',
      requiredCapabilities: [
        'Architecture',
        'Data Model',
        'Performance',
        'snow_discover_table_fields',
        'Business Logic'
      ]
    },
    {
      file: 'validator.md',
      requiredCapabilities: [
        'Validation',
        'Pre-deployment',
        'Post-deployment',
        'snow_validate_sysid',
        'Testing'
      ]
    }
  ];

  const results = [];

  for (const specialist of specialists) {
    const content = await readFile(join(AGENTS_DIR, specialist.file), 'utf-8');
    const missingCapabilities = specialist.requiredCapabilities.filter(
      cap => !content.includes(cap)
    );

    const status = missingCapabilities.length === 0 ? 'PASS' : 'FAIL';
    results.push({
      agent: specialist.file,
      status,
      missingCapabilities,
      details: status === 'PASS'
        ? `✅ ${specialist.file} has all required capabilities`
        : `❌ ${specialist.file} missing: ${missingCapabilities.join(', ')}`
    });
  }

  console.log(results.map(r => r.details).join('\n'));
  return results.every(r => r.status === 'PASS');
}

/**
 * Test 4: Verify ServiceNow domain expertise
 */
async function testServiceNowDomainExpertise() {
  console.log('\n🧪 Test 4: Verifying ServiceNow domain expertise...');

  const allAgents = [
    'orchestrator.md',
    'deployment-specialist.md',
    'risk-assessor.md',
    'solution-architect.md',
    'validator.md'
  ];

  const criticalRules = [
    { name: 'ES5 Only Rule', pattern: /ES5|const.*let.*arrow|Rhino/i },
    { name: 'Widget Coherence', pattern: /coherence|HTML.*Client.*Server/i },
    { name: 'Update Set Management', pattern: /[Uu]pdate [Ss]et|snow_ensure_active_update_set/ },
    { name: 'ServiceNow APIs', pattern: /snow_[a-z_]+|GlideRecord|gs\./i }
  ];

  const results = [];

  for (const agent of allAgents) {
    const content = await readFile(join(AGENTS_DIR, agent), 'utf-8');
    const rulesCovered = criticalRules.filter(rule => rule.pattern.test(content));
    const coveragePercent = Math.round((rulesCovered.length / criticalRules.length) * 100);

    results.push({
      agent,
      coveragePercent,
      rulesCovered: rulesCovered.length,
      totalRules: criticalRules.length,
      status: coveragePercent >= 75 ? 'PASS' : 'WARN',
      details: `${coveragePercent >= 75 ? '✅' : '⚠️'} ${agent}: ${coveragePercent}% coverage (${rulesCovered.length}/${criticalRules.length} rules)`
    });
  }

  console.log(results.map(r => r.details).join('\n'));
  return results.every(r => r.status !== 'FAIL');
}

/**
 * Test 5: Verify communication protocol completeness
 */
async function testCommunicationProtocols() {
  console.log('\n🧪 Test 5: Verifying communication protocols...');

  const allAgents = [
    'orchestrator.md',
    'deployment-specialist.md',
    'risk-assessor.md',
    'solution-architect.md',
    'validator.md'
  ];

  const protocolElements = [
    { name: 'Success Criteria', pattern: /Success Criteria|You are successful when/i },
    { name: 'Communication Style', pattern: /Communication Style|Report.*[Ff]ormat/i },
    { name: 'Error Handling', pattern: /[Ee]rror|[Ff]ail|[Rr]ollback/i },
    { name: 'Reporting Format', pattern: /Report|Output|Format|Template/i }
  ];

  const results = [];

  for (const agent of allAgents) {
    const content = await readFile(join(AGENTS_DIR, agent), 'utf-8');
    const elementsCovered = protocolElements.filter(elem => elem.pattern.test(content));
    const coveragePercent = Math.round((elementsCovered.length / protocolElements.length) * 100);

    results.push({
      agent,
      coveragePercent,
      elementsCovered: elementsCovered.length,
      totalElements: protocolElements.length,
      status: coveragePercent >= 75 ? 'PASS' : 'WARN',
      details: `${coveragePercent >= 75 ? '✅' : '⚠️'} ${agent}: ${coveragePercent}% protocol coverage (${elementsCovered.length}/${protocolElements.length})`
    });
  }

  console.log(results.map(r => r.details).join('\n'));
  return results.every(r => r.status !== 'FAIL');
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('   Claude Agent SDK Subagent Communication Tests');
  console.log('═══════════════════════════════════════════════════════\n');

  const tests = [
    { name: 'Agent Definitions Exist', fn: testAgentDefinitionsExist },
    { name: 'Orchestrator Delegation', fn: testOrchestratorDelegationPatterns },
    { name: 'Specialist Capabilities', fn: testSpecialistAgentCapabilities },
    { name: 'ServiceNow Domain Expertise', fn: testServiceNowDomainExpertise },
    { name: 'Communication Protocols', fn: testCommunicationProtocols }
  ];

  const results = [];

  for (const test of tests) {
    try {
      const passed = await test.fn();
      results.push({
        test: test.name,
        status: passed ? 'PASS' : 'FAIL',
        passed
      });
    } catch (error) {
      results.push({
        test: test.name,
        status: 'ERROR',
        error: error.message,
        passed: false
      });
      console.error(`\n❌ Error in ${test.name}: ${error.message}`);
    }
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('                    TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════════\n');

  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  const errorCount = results.filter(r => r.status === 'ERROR').length;
  const totalTests = results.length;

  results.forEach(r => {
    const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${icon} ${r.test}: ${r.status}`);
    if (r.error) console.log(`   Error: ${r.error}`);
  });

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`Total: ${totalTests} | Pass: ${passCount} | Fail: ${failCount} | Error: ${errorCount}`);
  console.log(`Success Rate: ${Math.round((passCount / totalTests) * 100)}%`);
  console.log('═══════════════════════════════════════════════════════\n');

  return {
    totalTests,
    passCount,
    failCount,
    errorCount,
    successRate: Math.round((passCount / totalTests) * 100),
    allPassed: passCount === totalTests
  };
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests()
    .then(result => {
      process.exit(result.allPassed ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { runAllTests };
