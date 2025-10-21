# ServiceNow Security Audit

Perform comprehensive security audits of ServiceNow instances covering ACLs, roles, vulnerabilities, compliance, and security best practices.

## When to use this skill

Use when asked to:
- "Run a security audit"
- "Check security configuration"
- "Audit ACLs and permissions"
- "Security compliance check"
- "Find security vulnerabilities"
- "Review access controls"

## What this skill does

Performs complete security audit including:
- ACL analysis (access control lists)
- Role hierarchy review
- User access validation
- Vulnerability scanning
- Compliance checking (SOX, GDPR, HIPAA)
- Security best practices validation
- Recommendations for improvements

## Step-by-step Workflow

### 1. Define Audit Scope

Ask user:
- Full instance audit or specific areas?
- Compliance requirements? (SOX, GDPR, HIPAA, ISO 27001)
- Specific tables/applications to focus on?
- Known security concerns?
- Remediation priority? (critical, high, medium, low)

### 2. Analyze Access Control Lists (ACLs)

Check ACL configuration for security issues:

```javascript
// Use snow_query_table to get all ACLs
{
  table: 'sys_security_acl',
  query: 'active=true',
  fields: [
    'name',
    'operation',
    'type',
    'script',
    'condition',
    'roles',
    'admin_overrides'
  ]
}
```

**Check for issues:**
- ✅ ACLs without role requirements
- ✅ Overly permissive scripts (e.g., `answer = true`)
- ✅ Disabled admin overrides on critical tables
- ✅ Missing ACLs on sensitive fields
- ✅ ACLs with complex/risky scripts

### 3. Review Role Hierarchy

Analyze role assignments and inheritance:

```javascript
// Query all roles
{
  table: 'sys_user_role',
  fields: ['name', 'description', 'contains_roles', 'elevated_privilege']
}

// Query role assignments
{
  table: 'sys_user_has_role',
  fields: ['user', 'role', 'granted_by', 'sys_created_on']
}
```

**Check for:**
- ✅ Users with admin role
- ✅ Elevated privilege roles
- ✅ Orphaned role assignments
- ✅ Role inheritance issues
- ✅ Over-privileged service accounts

### 4. Scan for Common Vulnerabilities

Check for common security vulnerabilities:

```javascript
// 1. Weak authentication settings
{
  action: 'check_auth_settings',
  checks: [
    'password_policy',
    'session_timeout',
    'mfa_enabled',
    'password_reset_policy'
  ]
}

// 2. Exposed endpoints
{
  table: 'sys_rest_message',
  query: 'active=true',
  validate: 'authentication_required'
}

// 3. Insecure client scripts
{
  table: 'sys_script_client',
  query: 'active=true',
  scan_for: [
    'eval(',
    'innerHTML',
    'document.write',
    'sensitive_data_in_client_script'
  ]
}

// 4. SQL injection risks
{
  table: 'sys_script',
  query: 'active=true',
  scan_for: [
    'GlideRecord.*getValue.*input',
    'addQuery.*input',
    'setDisplayValue.*input'
  ]
}
```

### 5. Check Compliance Requirements

#### SOX Compliance
```javascript
// Check separation of duties
{
  compliance: 'sox',
  checks: [
    {
      name: 'Separation of Duties',
      test: 'Users with both developer and admin roles',
      query: {
        table: 'sys_user_has_role',
        condition: 'role.name IN (admin,security_admin) AND user IN (SELECT user FROM sys_user_has_role WHERE role.name=soap)'
      }
    },
    {
      name: 'Change Approval',
      test: 'Changes without approval',
      query: {
        table: 'change_request',
        condition: 'approval=not requested'
      }
    },
    {
      name: 'Audit Trail',
      test: 'Critical tables without audit',
      query: {
        table: 'sys_db_object',
        condition: 'audit=false AND name IN (incident,change_request,problem)'
      }
    }
  ]
}
```

#### GDPR Compliance
```javascript
{
  compliance: 'gdpr',
  checks: [
    {
      name: 'Personal Data Protection',
      test: 'Tables with PII without encryption',
      tables: ['sys_user', 'customer', 'contact']
    },
    {
      name: 'Data Retention',
      test: 'Missing data retention policies',
      check_for: 'retention_policy_defined'
    },
    {
      name: 'Access Rights',
      test: 'User can access own data',
      validate: 'user_data_access_acl'
    }
  ]
}
```

#### HIPAA Compliance
```javascript
{
  compliance: 'hipaa',
  checks: [
    {
      name: 'PHI Encryption',
      test: 'Health data fields without encryption',
      scan_tables: ['patient', 'medical_record']
    },
    {
      name: 'Access Logging',
      test: 'PHI access logging enabled',
      validate: 'audit_trail_complete'
    },
    {
      name: 'Minimum Necessary',
      test: 'Users with unnecessary PHI access',
      check_acls: true
    }
  ]
}
```

### 6. Validate Security Best Practices

Check adherence to ServiceNow security best practices:

```javascript
{
  best_practices: [
    {
      name: 'Password Policy',
      checks: [
        'minimum_length >= 12',
        'complexity_requirements = true',
        'password_history >= 12',
        'lockout_threshold <= 5'
      ]
    },
    {
      name: 'Session Security',
      checks: [
        'session_timeout <= 30',
        'idle_timeout <= 15',
        'secure_cookie = true',
        'httponly_cookie = true'
      ]
    },
    {
      name: 'Network Security',
      checks: [
        'https_required = true',
        'tls_version >= 1.2',
        'ip_whitelist_enabled',
        'cdn_protection_enabled'
      ]
    },
    {
      name: 'Code Security',
      checks: [
        'no_eval_in_client_scripts',
        'no_sql_injection_risks',
        'no_xss_vulnerabilities',
        'input_validation_present'
      ]
    }
  ]
}
```

### 7. Check User Access

Review user accounts for security issues:

```javascript
// Find dormant admin accounts
{
  table: 'sys_user',
  query: 'active=true^last_login_time<javascript:gs.daysAgo(90)^sys_user_has_role.role.name=admin',
  fields: ['user_name', 'name', 'last_login_time', 'email']
}

// Find users with multiple high-privilege roles
{
  table: 'sys_user',
  query: 'sys_user_has_role.role.nameIN(admin,security_admin,soap)',
  aggregate: 'COUNT',
  group_by: 'user',
  having: 'COUNT > 1'
}

// Find service accounts without expiration
{
  table: 'sys_user',
  query: 'user_name LIKE service_%^expiration_dateISEMPTY',
  fields: ['user_name', 'name', 'roles']
}
```

### 8. Generate Audit Report

Compile findings into comprehensive report:

```javascript
{
  report: {
    executive_summary: {
      overall_score: calculated_score,  // 0-100
      critical_issues: critical_count,
      high_issues: high_count,
      medium_issues: medium_count,
      low_issues: low_count
    },

    findings: [
      {
        severity: 'critical',
        category: 'Access Control',
        title: 'Admin accounts without MFA',
        description: '5 admin accounts do not have MFA enabled',
        impact: 'High risk of unauthorized access to critical systems',
        recommendation: 'Enable MFA for all admin accounts immediately',
        affected_items: ['admin1', 'admin2', 'admin3', 'admin4', 'admin5'],
        remediation_steps: [
          '1. Navigate to User Administration',
          '2. Enable MFA for each admin user',
          '3. Verify MFA enrollment complete',
          '4. Update security policy to require MFA'
        ]
      },
      {
        severity: 'high',
        category: 'ACL Configuration',
        title: 'Missing ACLs on sensitive table',
        description: 'Table "sensitive_data" has no ACL restrictions',
        impact: 'Unauthorized users can view/modify sensitive data',
        recommendation: 'Create appropriate ACLs for all operations',
        affected_items: ['sensitive_data table'],
        remediation_steps: [
          '1. Create read ACL with role restriction',
          '2. Create write ACL with elevated privilege',
          '3. Create delete ACL for admin only',
          '4. Test ACL enforcement'
        ]
      }
      // ... more findings
    ],

    compliance_status: {
      sox: {
        compliant: false,
        issues: ['Separation of duties violations'],
        score: 75
      },
      gdpr: {
        compliant: true,
        issues: [],
        score: 95
      },
      hipaa: {
        compliant: false,
        issues: ['Missing PHI encryption', 'Incomplete audit trail'],
        score: 60
      }
    },

    recommendations: {
      immediate: [
        'Enable MFA for all admin accounts',
        'Fix ACL gaps on sensitive tables',
        'Disable dormant admin accounts'
      ],
      short_term: [
        'Implement password rotation policy',
        'Review and optimize role hierarchy',
        'Enable security event logging'
      ],
      long_term: [
        'Implement automated security scanning',
        'Conduct regular security training',
        'Establish security governance framework'
      ]
    }
  }
}
```

### 9. Create Remediation Plan

Provide actionable remediation steps:

```javascript
{
  remediation_plan: [
    {
      priority: 'critical',
      task: 'Enable MFA for admin accounts',
      owner: 'Security Team',
      due_date: '+7 days',
      steps: [
        '1. Identify all admin users',
        '2. Enable MFA requirement in auth policy',
        '3. Communicate to affected users',
        '4. Monitor MFA enrollment',
        '5. Verify 100% compliance'
      ],
      validation: 'All admin users have MFA enabled',
      tools: ['snow_property_set', 'snow_query_table']
    },
    {
      priority: 'high',
      task: 'Fix ACL gaps',
      owner: 'Platform Team',
      due_date: '+14 days',
      steps: [
        '1. Review all tables for missing ACLs',
        '2. Create ACLs based on sensitivity',
        '3. Test ACL enforcement',
        '4. Document ACL decisions'
      ],
      validation: 'All sensitive tables have appropriate ACLs',
      tools: ['snow_create_acl']
    }
    // ... more tasks
  ]
}
```

## Security Audit Checklist

### Access Control
- [ ] All tables have appropriate ACLs
- [ ] No overly permissive ACL scripts
- [ ] Sensitive fields have field-level ACLs
- [ ] Admin overrides configured correctly
- [ ] ACLs follow least privilege principle

### Authentication & Authorization
- [ ] Strong password policy enforced (12+ chars, complexity)
- [ ] MFA enabled for elevated privilege accounts
- [ ] Session timeout configured (<=30 min)
- [ ] Idle timeout configured (<=15 min)
- [ ] Account lockout policy enabled (<=5 attempts)

### Role Management
- [ ] Role hierarchy documented
- [ ] No users with conflicting roles (SOD)
- [ ] Service accounts have minimal roles
- [ ] Elevated privilege roles justified
- [ ] Regular role access reviews conducted

### User Accounts
- [ ] No dormant admin accounts (>90 days)
- [ ] Service accounts have expiration dates
- [ ] Default accounts disabled/removed
- [ ] User provisioning/deprovisioning process
- [ ] Regular access certification

### Code Security
- [ ] No eval() in client scripts
- [ ] Input validation on user inputs
- [ ] No SQL injection vulnerabilities
- [ ] No XSS vulnerabilities
- [ ] Secure coding practices followed

### Data Protection
- [ ] PII/PHI data encrypted
- [ ] Sensitive fields masked
- [ ] Data retention policies defined
- [ ] Backup encryption enabled
- [ ] Data classification implemented

### Audit & Compliance
- [ ] Audit logging enabled on critical tables
- [ ] Security event monitoring configured
- [ ] Compliance controls validated
- [ ] Audit trail complete and tamper-proof
- [ ] Regular compliance assessments

### Network Security
- [ ] HTTPS enforced
- [ ] TLS 1.2+ required
- [ ] IP whitelisting configured
- [ ] CDN/WAF protection enabled
- [ ] Rate limiting configured

## Common Security Issues & Fixes

### Issue: Admin without MFA
**Risk**: Unauthorized access to critical systems
**Fix**:
```javascript
// Enable MFA requirement
{
  property: 'glide.authenticate.multifactor.role',
  value: 'admin,security_admin'
}
```

### Issue: Table without ACLs
**Risk**: Unauthorized data access
**Fix**:
```javascript
// Create read ACL
{
  table: 'table_name',
  operation: 'read',
  roles: 'required_role',
  script: ''  // Or add conditional logic
}
```

### Issue: Weak Password Policy
**Risk**: Brute force attacks
**Fix**:
```javascript
// Update password policy
{
  properties: {
    'password.policy.minimum.length': '14',
    'password.policy.complexity.required': 'true',
    'password.policy.history.count': '12',
    'password.policy.lockout.threshold': '3'
  }
}
```

### Issue: Dormant Admin Account
**Risk**: Forgotten high-privilege access
**Fix**:
```javascript
// Disable dormant accounts
{
  table: 'sys_user',
  sys_id: 'dormant_user_sys_id',
  fields: {
    active: false,
    locked_out: true
  }
}
```

## Success Criteria

Security audit is complete when:
1. ✅ All findings documented
2. ✅ Severity levels assigned
3. ✅ Compliance status determined
4. ✅ Remediation plan created
5. ✅ Executive summary provided
6. ✅ Actionable recommendations given
7. ✅ Timeline for fixes established
8. ✅ Report delivered to stakeholders
