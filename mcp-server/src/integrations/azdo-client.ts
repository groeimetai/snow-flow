/**
 * Azure DevOps API Client Wrapper
 *
 * Provides a typed interface for Azure DevOps REST API operations.
 * Handles authentication, work item management, pipelines, and releases.
 */

import * as azdev from 'azure-devops-node-api';
import * as WorkItemTrackingApi from 'azure-devops-node-api/WorkItemTrackingApi';
import * as BuildApi from 'azure-devops-node-api/BuildApi';
import * as GitApi from 'azure-devops-node-api/GitApi';
import * as ReleaseApi from 'azure-devops-node-api/ReleaseApi';

// ===== TYPES =====

export interface AzDoCredentials {
  organization: string;  // e.g., "mycompany"
  pat: string;           // Personal Access Token
}

export interface AzDoWorkItem {
  id: number;
  rev: number;
  fields: {
    'System.Id': number;
    'System.Title': string;
    'System.WorkItemType': string;
    'System.State': string;
    'System.AssignedTo'?: {
      displayName: string;
      uniqueName: string;
    };
    'System.Description'?: string;
    'Microsoft.VSTS.Common.Priority'?: number;
    'System.Tags'?: string;
    'System.AreaPath'?: string;
    'System.IterationPath'?: string;
    'System.CreatedDate': string;
    'System.ChangedDate': string;
    [key: string]: any;
  };
  url: string;
}

export interface AzDoBuildRun {
  id: number;
  buildNumber: string;
  status: string;
  result?: string;
  queueTime: Date;
  startTime?: Date;
  finishTime?: Date;
  definition: {
    id: number;
    name: string;
  };
  project: {
    id: string;
    name: string;
  };
  sourceBranch: string;
  sourceVersion: string;
  _links: {
    web: { href: string };
    logs: { href: string };
  };
}

export interface AzDoPullRequest {
  pullRequestId: number;
  title: string;
  description?: string;
  status: string;
  createdBy: {
    displayName: string;
    uniqueName: string;
  };
  creationDate: Date;
  sourceRefName: string;
  targetRefName: string;
  repository: {
    id: string;
    name: string;
  };
  url: string;
}

export interface AzDoRelease {
  id: number;
  name: string;
  status: string;
  createdOn: Date;
  modifiedOn: Date;
  environments: Array<{
    id: number;
    name: string;
    status: string;
    deploySteps: Array<{
      status: string;
      operationStatus: string;
    }>;
  }>;
  _links: {
    web: { href: string };
  };
}

// ===== CLIENT =====

export class AzDoClient {
  private connection: azdev.WebApi;
  private credentials: AzDoCredentials;
  private baseUrl: string;

  constructor(credentials: AzDoCredentials) {
    this.credentials = credentials;
    this.baseUrl = 'https://dev.azure.com/' + credentials.organization;

    var authHandler = azdev.getPersonalAccessTokenHandler(credentials.pat);
    this.connection = new azdev.WebApi(this.baseUrl, authHandler);
  }

  // ===== WORK ITEM OPERATIONS =====

  /**
   * Get work item by ID
   */
  async getWorkItem(id: number, project: string): Promise<AzDoWorkItem> {
    try {
      var witApi = await this.connection.getWorkItemTrackingApi();
      var workItem = await witApi.getWorkItem(id, [project]);

      return workItem as AzDoWorkItem;
    } catch (error: any) {
      throw new Error('Failed to get Azure DevOps work item ' + id + ': ' + error.message);
    }
  }

  /**
   * Query work items with WIQL
   */
  async queryWorkItems(
    project: string,
    wiql: string,
    options: {
      top?: number;
    } = {}
  ): Promise<AzDoWorkItem[]> {
    try {
      var witApi = await this.connection.getWorkItemTrackingApi();

      var queryResult = await witApi.queryByWiql({
        query: wiql
      }, { projectId: project, project: project, teamId: undefined, team: undefined });

      if (!queryResult.workItems || queryResult.workItems.length === 0) {
        return [];
      }

      var ids = [];
      for (var i = 0; i < queryResult.workItems.length; i++) {
        var item = queryResult.workItems[i];
        if (item && item.id) {
          ids.push(item.id);
        }
      }

      if (ids.length === 0) {
        return [];
      }

      var workItems = await witApi.getWorkItems(ids, [project]);

      return workItems as AzDoWorkItem[];
    } catch (error: any) {
      throw new Error('Failed to query Azure DevOps work items: ' + error.message);
    }
  }

  /**
   * Get work items in specific states (for backlog sync)
   */
  async getWorkItemsBacklog(
    project: string,
    options: {
      states?: string[];
      workItemTypes?: string[];
      areaPath?: string;
      iterationPath?: string;
      maxResults?: number;
    } = {}
  ): Promise<AzDoWorkItem[]> {
    var wiqlParts = ['SELECT [System.Id], [System.Title], [System.State], [System.WorkItemType]'];
    wiqlParts.push('FROM WorkItems');

    var whereClauses = [];
    whereClauses.push('[System.TeamProject] = \'' + project + '\'');

    if (options.states && options.states.length > 0) {
      var stateList = options.states.map(function(s) { return '\'' + s + '\''; }).join(', ');
      whereClauses.push('[System.State] IN (' + stateList + ')');
    } else {
      whereClauses.push('[System.State] IN (\'New\', \'Active\', \'Committed\')');
    }

    if (options.workItemTypes && options.workItemTypes.length > 0) {
      var typeList = options.workItemTypes.map(function(t) { return '\'' + t + '\''; }).join(', ');
      whereClauses.push('[System.WorkItemType] IN (' + typeList + ')');
    }

    if (options.areaPath) {
      whereClauses.push('[System.AreaPath] UNDER \'' + options.areaPath + '\'');
    }

    if (options.iterationPath) {
      whereClauses.push('[System.IterationPath] UNDER \'' + options.iterationPath + '\'');
    }

    wiqlParts.push('WHERE ' + whereClauses.join(' AND '));
    wiqlParts.push('ORDER BY [Microsoft.VSTS.Common.Priority] ASC, [System.CreatedDate] DESC');

    var wiql = wiqlParts.join(' ');

    return this.queryWorkItems(project, wiql, {
      top: options.maxResults || 100
    });
  }

  /**
   * Create work item
   */
  async createWorkItem(
    project: string,
    workItemType: string,
    fields: Record<string, any>
  ): Promise<AzDoWorkItem> {
    try {
      var witApi = await this.connection.getWorkItemTrackingApi();

      var patchDocument = [];
      for (var fieldName in fields) {
        if (fields.hasOwnProperty(fieldName)) {
          patchDocument.push({
            op: 'add',
            path: '/fields/' + fieldName,
            value: fields[fieldName]
          });
        }
      }

      var workItem = await witApi.createWorkItem(
        undefined,
        patchDocument,
        project,
        workItemType
      );

      return workItem as AzDoWorkItem;
    } catch (error: any) {
      throw new Error('Failed to create Azure DevOps work item: ' + error.message);
    }
  }

  /**
   * Update work item
   */
  async updateWorkItem(
    id: number,
    project: string,
    fields: Record<string, any>
  ): Promise<AzDoWorkItem> {
    try {
      var witApi = await this.connection.getWorkItemTrackingApi();

      var patchDocument = [];
      for (var fieldName in fields) {
        if (fields.hasOwnProperty(fieldName)) {
          patchDocument.push({
            op: 'replace',
            path: '/fields/' + fieldName,
            value: fields[fieldName]
          });
        }
      }

      var workItem = await witApi.updateWorkItem(
        undefined,
        patchDocument,
        id,
        project
      );

      return workItem as AzDoWorkItem;
    } catch (error: any) {
      throw new Error('Failed to update Azure DevOps work item ' + id + ': ' + error.message);
    }
  }

  // ===== PIPELINE/BUILD OPERATIONS =====

  /**
   * Get pipeline runs
   */
  async getPipelineRuns(
    project: string,
    pipelineId?: number,
    options: {
      top?: number;
      branch?: string;
      status?: string;
    } = {}
  ): Promise<AzDoBuildRun[]> {
    try {
      var buildApi = await this.connection.getBuildApi();

      var builds = await buildApi.getBuilds(
        project,
        pipelineId ? [pipelineId] : undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        options.top || 50,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        options.branch
      );

      // Convert SDK Build objects to our AzDoBuildRun type
      var result: AzDoBuildRun[] = [];
      for (var i = 0; i < builds.length; i++) {
        var build = builds[i];
        if (build) {
          result.push({
            id: build.id || 0,
            buildNumber: build.buildNumber || '',
            status: (build.status as any) || '',
            result: (build.result as any),
            queueTime: build.queueTime || new Date(),
            startTime: build.startTime,
            finishTime: build.finishTime,
            definition: {
              id: build.definition?.id || 0,
              name: build.definition?.name || ''
            },
            project: {
              id: build.project?.id || '',
              name: build.project?.name || ''
            },
            sourceBranch: build.sourceBranch || '',
            sourceVersion: build.sourceVersion || '',
            _links: {
              web: { href: build._links?.web?.href || '' },
              logs: { href: build._links?.self?.href || '' }
            }
          });
        }
      }

      return result;
    } catch (error: any) {
      throw new Error('Failed to get Azure DevOps pipeline runs: ' + error.message);
    }
  }

  /**
   * Trigger pipeline
   */
  async triggerPipeline(
    project: string,
    pipelineId: number,
    branch: string,
    parameters?: Record<string, string>
  ): Promise<AzDoBuildRun> {
    try {
      var buildApi = await this.connection.getBuildApi();

      var build = await buildApi.queueBuild({
        definition: { id: pipelineId },
        sourceBranch: branch,
        parameters: parameters ? JSON.stringify(parameters) : undefined
      }, project);

      return {
        id: build.id || 0,
        buildNumber: build.buildNumber || '',
        status: (build.status as any) || '',
        result: (build.result as any),
        queueTime: build.queueTime || new Date(),
        startTime: build.startTime,
        finishTime: build.finishTime,
        definition: {
          id: build.definition?.id || 0,
          name: build.definition?.name || ''
        },
        project: {
          id: build.project?.id || '',
          name: build.project?.name || ''
        },
        sourceBranch: build.sourceBranch || '',
        sourceVersion: build.sourceVersion || '',
        _links: {
          web: { href: build._links?.web?.href || '' },
          logs: { href: build._links?.self?.href || '' }
        }
      };
    } catch (error: any) {
      throw new Error('Failed to trigger Azure DevOps pipeline: ' + error.message);
    }
  }

  // ===== GIT/PR OPERATIONS =====

  /**
   * Get pull requests
   */
  async getPullRequests(
    project: string,
    repositoryId: string,
    options: {
      status?: string;
      creatorId?: string;
      top?: number;
    } = {}
  ): Promise<AzDoPullRequest[]> {
    try {
      var gitApi = await this.connection.getGitApi();

      var prs = await gitApi.getPullRequests(
        repositoryId,
        {
          status: options.status as any,
          creatorId: options.creatorId
        },
        project,
        undefined,
        0,
        options.top || 50
      );

      // Convert SDK GitPullRequest objects to our AzDoPullRequest type
      var result: AzDoPullRequest[] = [];
      for (var i = 0; i < prs.length; i++) {
        var pr = prs[i];
        if (pr) {
          result.push({
            pullRequestId: pr.pullRequestId || 0,
            title: pr.title || '',
            description: pr.description,
            status: (pr.status as any) || '',
            createdBy: {
              displayName: pr.createdBy?.displayName || '',
              uniqueName: pr.createdBy?.uniqueName || ''
            },
            creationDate: pr.creationDate || new Date(),
            sourceRefName: pr.sourceRefName || '',
            targetRefName: pr.targetRefName || '',
            repository: {
              id: pr.repository?.id || '',
              name: pr.repository?.name || ''
            },
            url: pr.url || ''
          });
        }
      }

      return result;
    } catch (error: any) {
      throw new Error('Failed to get Azure DevOps pull requests: ' + error.message);
    }
  }

  /**
   * Create pull request
   */
  async createPullRequest(
    project: string,
    repositoryId: string,
    sourceBranch: string,
    targetBranch: string,
    title: string,
    description?: string
  ): Promise<AzDoPullRequest> {
    try {
      var gitApi = await this.connection.getGitApi();

      var pr = await gitApi.createPullRequest({
        sourceRefName: 'refs/heads/' + sourceBranch,
        targetRefName: 'refs/heads/' + targetBranch,
        title: title,
        description: description
      }, repositoryId, project);

      return {
        pullRequestId: pr.pullRequestId || 0,
        title: pr.title || '',
        description: pr.description,
        status: (pr.status as any) || '',
        createdBy: {
          displayName: pr.createdBy?.displayName || '',
          uniqueName: pr.createdBy?.uniqueName || ''
        },
        creationDate: pr.creationDate || new Date(),
        sourceRefName: pr.sourceRefName || '',
        targetRefName: pr.targetRefName || '',
        repository: {
          id: pr.repository?.id || '',
          name: pr.repository?.name || ''
        },
        url: pr.url || ''
      };
    } catch (error: any) {
      throw new Error('Failed to create Azure DevOps pull request: ' + error.message);
    }
  }

  // ===== RELEASE OPERATIONS =====

  /**
   * Get releases
   */
  async getReleases(
    project: string,
    options: {
      definitionId?: number;
      top?: number;
    } = {}
  ): Promise<AzDoRelease[]> {
    try {
      var releaseApi = await this.connection.getReleaseApi();

      var releases = await releaseApi.getReleases(
        project,
        options.definitionId,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        options.top || 50
      );

      // Convert SDK Release objects to our AzDoRelease type
      var result: AzDoRelease[] = [];
      for (var i = 0; i < releases.length; i++) {
        var release = releases[i];
        if (release) {
          var environments = [];
          if (release.environments) {
            for (var j = 0; j < release.environments.length; j++) {
              var env = release.environments[j];
              if (env) {
                var deploySteps = [];
                if (env.deploySteps) {
                  for (var k = 0; k < env.deploySteps.length; k++) {
                    var step = env.deploySteps[k];
                    if (step) {
                      deploySteps.push({
                        status: (step.status as any) || '',
                        operationStatus: (step.operationStatus as any) || ''
                      });
                    }
                  }
                }
                environments.push({
                  id: env.id || 0,
                  name: env.name || '',
                  status: (env.status as any) || '',
                  deploySteps: deploySteps
                });
              }
            }
          }
          result.push({
            id: release.id || 0,
            name: release.name || '',
            status: (release.status as any) || '',
            createdOn: release.createdOn || new Date(),
            modifiedOn: release.modifiedOn || new Date(),
            environments: environments,
            _links: {
              web: { href: release._links?.web?.href || '' }
            }
          });
        }
      }

      return result;
    } catch (error: any) {
      throw new Error('Failed to get Azure DevOps releases: ' + error.message);
    }
  }

  /**
   * Create release
   */
  async createRelease(
    project: string,
    definitionId: number,
    description?: string,
    artifacts?: Array<{
      alias: string;
      instanceReference: {
        id: string;
        name?: string;
      };
    }>
  ): Promise<AzDoRelease> {
    try {
      var releaseApi = await this.connection.getReleaseApi();

      var release = await releaseApi.createRelease({
        definitionId: definitionId,
        description: description || 'Release created by Snow-Flow agent',
        artifacts: artifacts
      }, project);

      // Convert SDK Release object to our AzDoRelease type
      var environments = [];
      if (release.environments) {
        for (var j = 0; j < release.environments.length; j++) {
          var env = release.environments[j];
          if (env) {
            var deploySteps = [];
            if (env.deploySteps) {
              for (var k = 0; k < env.deploySteps.length; k++) {
                var step = env.deploySteps[k];
                if (step) {
                  deploySteps.push({
                    status: (step.status as any) || '',
                    operationStatus: (step.operationStatus as any) || ''
                  });
                }
              }
            }
            environments.push({
              id: env.id || 0,
              name: env.name || '',
              status: (env.status as any) || '',
              deploySteps: deploySteps
            });
          }
        }
      }

      return {
        id: release.id || 0,
        name: release.name || '',
        status: (release.status as any) || '',
        createdOn: release.createdOn || new Date(),
        modifiedOn: release.modifiedOn || new Date(),
        environments: environments,
        _links: {
          web: { href: release._links?.web?.href || '' }
        }
      };
    } catch (error: any) {
      throw new Error('Failed to create Azure DevOps release: ' + error.message);
    }
  }

  // ===== FIELD MAPPING =====

  /**
   * Map Azure DevOps work item to ServiceNow incident/task fields
   */
  mapToServiceNow(workItem: AzDoWorkItem): {
    short_description: string;
    description: string;
    priority: number;
    state: number;
    assigned_to?: string;
    category?: string;
    u_azdo_work_item_id: number;
    u_azdo_work_item_type: string;
    u_azdo_state: string;
    u_azdo_url: string;
  } {
    var priorityMap: Record<number, number> = {
      1: 1,  // Priority 1 → Critical
      2: 2,  // Priority 2 → High
      3: 3,  // Priority 3 → Medium
      4: 4   // Priority 4 → Low
    };

    var priority = workItem.fields['Microsoft.VSTS.Common.Priority'];
    var mappedPriority = priority ? (priorityMap[priority] || 3) : 3;

    var stateMap: Record<string, number> = {
      'New': 1,
      'Active': 2,
      'Committed': 2,
      'Resolved': 6,
      'Closed': 7,
      'Done': 6,
      'Removed': 8
    };

    var state = workItem.fields['System.State'];
    var mappedState = stateMap[state] || 1;

    var descriptionField = workItem.fields['System.Description'];
    var description = '';
    if (descriptionField) {
      if (typeof descriptionField === 'string') {
        description = descriptionField;
      } else {
        description = String(descriptionField);
      }
    }

    var assignedTo = workItem.fields['System.AssignedTo'];
    var assignedToName = assignedTo ? assignedTo.displayName : undefined;

    return {
      short_description: workItem.fields['System.Title'],
      description: description || 'Synced from Azure DevOps: ' + workItem.id,
      priority: mappedPriority,
      state: mappedState,
      assigned_to: assignedToName,
      category: workItem.fields['System.WorkItemType'],
      u_azdo_work_item_id: workItem.fields['System.Id'],
      u_azdo_work_item_type: workItem.fields['System.WorkItemType'],
      u_azdo_state: workItem.fields['System.State'],
      u_azdo_url: workItem.url
    };
  }
}

export default AzDoClient;
