/**
 * Azure DevOps MCP Tool Implementations
 *
 * All 10 Azure DevOps integration tools with complete implementations.
 * Designed for AGENT AUTONOMY - enabling AI agents to manage DevOps workflows.
 */

import AzDoClient, { AzDoCredentials, AzDoWorkItem, AzDoBuildRun, AzDoPullRequest, AzDoRelease } from './azdo-client.js';
import { Customer } from '../database/schema.js';

// ===== TYPES =====

interface AzDoToolCredentials {
  azureDevOps: AzDoCredentials;
}

// ===== TOOL 1: SYNC WORK ITEMS =====

export async function azdoSyncWorkItems(
  args: {
    organization: string;
    project: string;
    states?: string[];
    workItemTypes?: string[];
    areaPath?: string;
    iterationPath?: string;
    maxResults?: number;
  },
  _customer: Customer,
  credentials: AzDoToolCredentials
): Promise<{
  success: boolean;
  syncedWorkItems: number;
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ workItemId: number; error: string }>;
  workItems: Array<{
    azDoId: number;
    title: string;
    state: string;
    syncedFields: any;
  }>;
}> {
  try {
    if (!credentials.azureDevOps) {
      throw new Error('Azure DevOps credentials are required');
    }

    var client = new AzDoClient(credentials.azureDevOps);

    var workItems = await client.getWorkItemsBacklog(args.project, {
      states: args.states,
      workItemTypes: args.workItemTypes,
      areaPath: args.areaPath,
      iterationPath: args.iterationPath,
      maxResults: args.maxResults || 100
    });

    var syncResults = {
      success: true,
      syncedWorkItems: workItems.length,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as Array<{ workItemId: number; error: string }>,
      workItems: [] as Array<{
        azDoId: number;
        title: string;
        state: string;
        syncedFields: any;
      }>
    };

    for (var i = 0; i < workItems.length; i++) {
      var workItem = workItems[i];

      if (!workItem) {
        continue;
      }

      try {
        var mapped = client.mapToServiceNow(workItem);

        syncResults.workItems.push({
          azDoId: workItem.fields['System.Id'],
          title: workItem.fields['System.Title'],
          state: workItem.fields['System.State'],
          syncedFields: mapped
        });

        syncResults.created++;

      } catch (error: any) {
        syncResults.errors.push({
          workItemId: workItem.fields['System.Id'],
          error: error.message
        });
      }
    }

    return syncResults;

  } catch (error: any) {
    throw new Error('Failed to sync Azure DevOps work items: ' + error.message);
  }
}

// ===== TOOL 2: GET WORK ITEM =====

export async function azdoGetWorkItem(
  args: {
    organization: string;
    project: string;
    workItemId: number;
  },
  _customer: Customer,
  credentials: AzDoToolCredentials
): Promise<{
  workItem: AzDoWorkItem;
  servicenowMapping: any;
}> {
  try {
    if (!credentials.azureDevOps) {
      throw new Error('Azure DevOps credentials are required');
    }

    var client = new AzDoClient(credentials.azureDevOps);
    var workItem = await client.getWorkItem(args.workItemId, args.project);
    var mapped = client.mapToServiceNow(workItem);

    return {
      workItem: workItem,
      servicenowMapping: mapped
    };

  } catch (error: any) {
    throw new Error('Failed to get Azure DevOps work item: ' + error.message);
  }
}

// ===== TOOL 3: CREATE WORK ITEM =====

export async function azdoCreateWorkItem(
  args: {
    organization: string;
    project: string;
    workItemType: string;
    title: string;
    description?: string;
    priority?: number;
    assignedTo?: string;
    tags?: string;
    areaPath?: string;
    iterationPath?: string;
  },
  _customer: Customer,
  credentials: AzDoToolCredentials
): Promise<{
  workItem: AzDoWorkItem;
  id: number;
  url: string;
}> {
  try {
    if (!credentials.azureDevOps) {
      throw new Error('Azure DevOps credentials are required');
    }

    var client = new AzDoClient(credentials.azureDevOps);

    var fields: Record<string, any> = {
      'System.Title': args.title
    };

    if (args.description) {
      fields['System.Description'] = args.description;
    }

    if (args.priority) {
      fields['Microsoft.VSTS.Common.Priority'] = args.priority;
    }

    if (args.assignedTo) {
      fields['System.AssignedTo'] = args.assignedTo;
    }

    if (args.tags) {
      fields['System.Tags'] = args.tags;
    }

    if (args.areaPath) {
      fields['System.AreaPath'] = args.areaPath;
    }

    if (args.iterationPath) {
      fields['System.IterationPath'] = args.iterationPath;
    }

    var workItem = await client.createWorkItem(
      args.project,
      args.workItemType,
      fields
    );

    return {
      workItem: workItem,
      id: workItem.fields['System.Id'],
      url: workItem.url
    };

  } catch (error: any) {
    throw new Error('Failed to create Azure DevOps work item: ' + error.message);
  }
}

// ===== TOOL 4: UPDATE WORK ITEM =====

export async function azdoUpdateWorkItem(
  args: {
    organization: string;
    project: string;
    workItemId: number;
    title?: string;
    description?: string;
    state?: string;
    priority?: number;
    assignedTo?: string;
    tags?: string;
  },
  _customer: Customer,
  credentials: AzDoToolCredentials
): Promise<{
  workItem: AzDoWorkItem;
  updated: boolean;
}> {
  try {
    if (!credentials.azureDevOps) {
      throw new Error('Azure DevOps credentials are required');
    }

    var client = new AzDoClient(credentials.azureDevOps);

    var fields: Record<string, any> = {};

    if (args.title) {
      fields['System.Title'] = args.title;
    }

    if (args.description) {
      fields['System.Description'] = args.description;
    }

    if (args.state) {
      fields['System.State'] = args.state;
    }

    if (args.priority) {
      fields['Microsoft.VSTS.Common.Priority'] = args.priority;
    }

    if (args.assignedTo) {
      fields['System.AssignedTo'] = args.assignedTo;
    }

    if (args.tags) {
      fields['System.Tags'] = args.tags;
    }

    var workItem = await client.updateWorkItem(
      args.workItemId,
      args.project,
      fields
    );

    return {
      workItem: workItem,
      updated: true
    };

  } catch (error: any) {
    throw new Error('Failed to update Azure DevOps work item: ' + error.message);
  }
}

// ===== TOOL 5: GET PIPELINE RUNS =====

export async function azdoGetPipelineRuns(
  args: {
    organization: string;
    project: string;
    pipelineId?: number;
    branch?: string;
    status?: string;
    maxResults?: number;
  },
  _customer: Customer,
  credentials: AzDoToolCredentials
): Promise<{
  runs: AzDoBuildRun[];
  total: number;
  failed: number;
  succeeded: number;
  inProgress: number;
}> {
  try {
    if (!credentials.azureDevOps) {
      throw new Error('Azure DevOps credentials are required');
    }

    var client = new AzDoClient(credentials.azureDevOps);

    var runs = await client.getPipelineRuns(args.project, args.pipelineId, {
      top: args.maxResults || 50,
      branch: args.branch,
      status: args.status
    });

    var failed = 0;
    var succeeded = 0;
    var inProgress = 0;

    for (var i = 0; i < runs.length; i++) {
      var run = runs[i];
      if (run && run.result === 'failed') {
        failed++;
      } else if (run && run.result === 'succeeded') {
        succeeded++;
      } else if (run && run.status === 'inProgress') {
        inProgress++;
      }
    }

    return {
      runs: runs,
      total: runs.length,
      failed: failed,
      succeeded: succeeded,
      inProgress: inProgress
    };

  } catch (error: any) {
    throw new Error('Failed to get Azure DevOps pipeline runs: ' + error.message);
  }
}

// ===== TOOL 6: TRIGGER PIPELINE =====

export async function azdoTriggerPipeline(
  args: {
    organization: string;
    project: string;
    pipelineId: number;
    branch: string;
    parameters?: Record<string, string>;
  },
  _customer: Customer,
  credentials: AzDoToolCredentials
): Promise<{
  run: AzDoBuildRun;
  triggered: boolean;
  buildNumber: string;
  url: string;
}> {
  try {
    if (!credentials.azureDevOps) {
      throw new Error('Azure DevOps credentials are required');
    }

    var client = new AzDoClient(credentials.azureDevOps);

    var run = await client.triggerPipeline(
      args.project,
      args.pipelineId,
      args.branch,
      args.parameters
    );

    return {
      run: run,
      triggered: true,
      buildNumber: run.buildNumber,
      url: run._links.web.href
    };

  } catch (error: any) {
    throw new Error('Failed to trigger Azure DevOps pipeline: ' + error.message);
  }
}

// ===== TOOL 7: GET PULL REQUESTS =====

export async function azdoGetPullRequests(
  args: {
    organization: string;
    project: string;
    repositoryId: string;
    status?: string;
    creatorId?: string;
    maxResults?: number;
  },
  _customer: Customer,
  credentials: AzDoToolCredentials
): Promise<{
  pullRequests: AzDoPullRequest[];
  total: number;
  active: number;
  completed: number;
}> {
  try {
    if (!credentials.azureDevOps) {
      throw new Error('Azure DevOps credentials are required');
    }

    var client = new AzDoClient(credentials.azureDevOps);

    var prs = await client.getPullRequests(args.project, args.repositoryId, {
      status: args.status,
      creatorId: args.creatorId,
      top: args.maxResults || 50
    });

    var active = 0;
    var completed = 0;

    for (var i = 0; i < prs.length; i++) {
      var pr = prs[i];
      if (pr && pr.status === 'active') {
        active++;
      } else if (pr && pr.status === 'completed') {
        completed++;
      }
    }

    return {
      pullRequests: prs,
      total: prs.length,
      active: active,
      completed: completed
    };

  } catch (error: any) {
    throw new Error('Failed to get Azure DevOps pull requests: ' + error.message);
  }
}

// ===== TOOL 8: CREATE PULL REQUEST =====

export async function azdoCreatePullRequest(
  args: {
    organization: string;
    project: string;
    repositoryId: string;
    sourceBranch: string;
    targetBranch: string;
    title: string;
    description?: string;
  },
  _customer: Customer,
  credentials: AzDoToolCredentials
): Promise<{
  pullRequest: AzDoPullRequest;
  pullRequestId: number;
  url: string;
}> {
  try {
    if (!credentials.azureDevOps) {
      throw new Error('Azure DevOps credentials are required');
    }

    var client = new AzDoClient(credentials.azureDevOps);

    var pr = await client.createPullRequest(
      args.project,
      args.repositoryId,
      args.sourceBranch,
      args.targetBranch,
      args.title,
      args.description
    );

    return {
      pullRequest: pr,
      pullRequestId: pr.pullRequestId,
      url: pr.url
    };

  } catch (error: any) {
    throw new Error('Failed to create Azure DevOps pull request: ' + error.message);
  }
}

// ===== TOOL 9: GET RELEASES =====

export async function azdoGetReleases(
  args: {
    organization: string;
    project: string;
    definitionId?: number;
    maxResults?: number;
  },
  _customer: Customer,
  credentials: AzDoToolCredentials
): Promise<{
  releases: AzDoRelease[];
  total: number;
  activeDeployments: number;
}> {
  try {
    if (!credentials.azureDevOps) {
      throw new Error('Azure DevOps credentials are required');
    }

    var client = new AzDoClient(credentials.azureDevOps);

    var releases = await client.getReleases(args.project, {
      definitionId: args.definitionId,
      top: args.maxResults || 50
    });

    var activeDeployments = 0;

    for (var i = 0; i < releases.length; i++) {
      var release = releases[i];
      if (release && release.status === 'active') {
        activeDeployments++;
      }
    }

    return {
      releases: releases,
      total: releases.length,
      activeDeployments: activeDeployments
    };

  } catch (error: any) {
    throw new Error('Failed to get Azure DevOps releases: ' + error.message);
  }
}

// ===== TOOL 10: CREATE RELEASE =====

export async function azdoCreateRelease(
  args: {
    organization: string;
    project: string;
    definitionId: number;
    description?: string;
    artifacts?: Array<{
      alias: string;
      instanceReference: {
        id: string;
        name?: string;
      };
    }>;
  },
  _customer: Customer,
  credentials: AzDoToolCredentials
): Promise<{
  release: AzDoRelease;
  releaseId: number;
  url: string;
}> {
  try {
    if (!credentials.azureDevOps) {
      throw new Error('Azure DevOps credentials are required');
    }

    var client = new AzDoClient(credentials.azureDevOps);

    var release = await client.createRelease(
      args.project,
      args.definitionId,
      args.description,
      args.artifacts
    );

    return {
      release: release,
      releaseId: release.id,
      url: release._links.web.href
    };

  } catch (error: any) {
    throw new Error('Failed to create Azure DevOps release: ' + error.message);
  }
}
