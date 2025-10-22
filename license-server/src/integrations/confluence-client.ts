/**
 * Confluence API Client Wrapper
 *
 * Provides a typed interface for Confluence REST API operations.
 * Handles authentication, page management, space management, and search.
 */

import axios, { AxiosInstance } from 'axios';

// ===== TYPES =====

export interface ConfluenceCredentials {
  baseUrl: string;    // e.g., "https://company.atlassian.net/wiki"
  email: string;      // Atlassian account email
  apiToken: string;   // API token
}

export interface ConfluencePage {
  id: string;
  type: string;
  status: string;
  title: string;
  space: {
    key: string;
    name: string;
  };
  version: {
    number: number;
    when: string;
  };
  body?: {
    storage?: {
      value: string;
      representation: string;
    };
    view?: {
      value: string;
      representation: string;
    };
  };
  _links: {
    webui: string;
    self: string;
  };
  metadata?: any;
}

export interface ConfluenceSpace {
  id: number;
  key: string;
  name: string;
  type: string;
  status: string;
  description?: {
    plain?: {
      value: string;
    };
  };
  homepage?: {
    id: string;
    title: string;
  };
  _links: {
    webui: string;
    self: string;
  };
}

export interface ConfluenceSearchResult {
  results: Array<{
    content: ConfluencePage;
    title: string;
    excerpt: string;
    url: string;
    lastModified: string;
  }>;
  size: number;
  totalSize: number;
}

// ===== CLIENT =====

export class ConfluenceClient {
  private axios: AxiosInstance;
  private credentials: ConfluenceCredentials;
  private baseUrl: string;

  constructor(credentials: ConfluenceCredentials) {
    this.credentials = credentials;
    this.baseUrl = credentials.baseUrl.replace(/\/+$/, ''); // Remove trailing slash

    var auth = Buffer.from(credentials.email + ':' + credentials.apiToken).toString('base64');

    this.axios = axios.create({
      baseURL: this.baseUrl + '/rest/api',
      headers: {
        'Authorization': 'Basic ' + auth,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
  }

  // ===== PAGE OPERATIONS =====

  /**
   * Get page by ID
   */
  async getPage(pageId: string, expand?: string[]): Promise<ConfluencePage> {
    try {
      var expandParam = expand ? expand.join(',') : 'body.storage,body.view,version,space';
      var response = await this.axios.get('/content/' + pageId, {
        params: { expand: expandParam }
      });

      return response.data as ConfluencePage;
    } catch (error: any) {
      throw new Error('Failed to get Confluence page ' + pageId + ': ' + (error.response?.data?.message || error.message));
    }
  }

  /**
   * Get pages in a space
   */
  async getPagesInSpace(
    spaceKey: string,
    options: {
      limit?: number;
      start?: number;
      expand?: string[];
    } = {}
  ): Promise<ConfluencePage[]> {
    try {
      var expandParam = options.expand ? options.expand.join(',') : 'body.storage,version,space';

      var response = await this.axios.get('/content', {
        params: {
          spaceKey: spaceKey,
          type: 'page',
          limit: options.limit || 100,
          start: options.start || 0,
          expand: expandParam
        }
      });

      return response.data.results as ConfluencePage[];
    } catch (error: any) {
      throw new Error('Failed to get pages in space ' + spaceKey + ': ' + (error.response?.data?.message || error.message));
    }
  }

  /**
   * Create page
   */
  async createPage(
    spaceKey: string,
    title: string,
    content: string,
    options: {
      parentId?: string;
      representation?: string;
    } = {}
  ): Promise<ConfluencePage> {
    try {
      var data: any = {
        type: 'page',
        title: title,
        space: {
          key: spaceKey
        },
        body: {
          storage: {
            value: content,
            representation: options.representation || 'storage'
          }
        }
      };

      if (options.parentId) {
        data.ancestors = [{ id: options.parentId }];
      }

      var response = await this.axios.post('/content', data);

      return response.data as ConfluencePage;
    } catch (error: any) {
      throw new Error('Failed to create Confluence page: ' + (error.response?.data?.message || error.message));
    }
  }

  /**
   * Update page
   */
  async updatePage(
    pageId: string,
    title: string,
    content: string,
    version: number,
    options: {
      representation?: string;
    } = {}
  ): Promise<ConfluencePage> {
    try {
      var data = {
        version: {
          number: version + 1
        },
        title: title,
        type: 'page',
        body: {
          storage: {
            value: content,
            representation: options.representation || 'storage'
          }
        }
      };

      var response = await this.axios.put('/content/' + pageId, data);

      return response.data as ConfluencePage;
    } catch (error: any) {
      throw new Error('Failed to update Confluence page ' + pageId + ': ' + (error.response?.data?.message || error.message));
    }
  }

  /**
   * Delete page
   */
  async deletePage(pageId: string): Promise<void> {
    try {
      await this.axios.delete('/content/' + pageId);
    } catch (error: any) {
      throw new Error('Failed to delete Confluence page ' + pageId + ': ' + (error.response?.data?.message || error.message));
    }
  }

  // ===== SPACE OPERATIONS =====

  /**
   * Get space by key
   */
  async getSpace(spaceKey: string, expand?: string[]): Promise<ConfluenceSpace> {
    try {
      var expandParam = expand ? expand.join(',') : 'description.plain,homepage';
      var response = await this.axios.get('/space/' + spaceKey, {
        params: { expand: expandParam }
      });

      return response.data as ConfluenceSpace;
    } catch (error: any) {
      throw new Error('Failed to get Confluence space ' + spaceKey + ': ' + (error.response?.data?.message || error.message));
    }
  }

  /**
   * List all spaces
   */
  async listSpaces(options: {
    limit?: number;
    start?: number;
    type?: string;
  } = {}): Promise<ConfluenceSpace[]> {
    try {
      var response = await this.axios.get('/space', {
        params: {
          limit: options.limit || 100,
          start: options.start || 0,
          type: options.type,
          expand: 'description.plain,homepage'
        }
      });

      return response.data.results as ConfluenceSpace[];
    } catch (error: any) {
      throw new Error('Failed to list Confluence spaces: ' + (error.response?.data?.message || error.message));
    }
  }

  /**
   * Create space
   */
  async createSpace(
    key: string,
    name: string,
    description?: string
  ): Promise<ConfluenceSpace> {
    try {
      var data: any = {
        key: key,
        name: name,
        description: {
          plain: {
            value: description || '',
            representation: 'plain'
          }
        }
      };

      var response = await this.axios.post('/space', data);

      return response.data as ConfluenceSpace;
    } catch (error: any) {
      throw new Error('Failed to create Confluence space: ' + (error.response?.data?.message || error.message));
    }
  }

  // ===== SEARCH OPERATIONS =====

  /**
   * Search content using CQL
   */
  async searchContent(
    cql: string,
    options: {
      limit?: number;
      start?: number;
      expand?: string[];
    } = {}
  ): Promise<ConfluenceSearchResult> {
    try {
      var expandParam = options.expand ? options.expand.join(',') : 'content.body.storage,content.version';

      var response = await this.axios.get('/content/search', {
        params: {
          cql: cql,
          limit: options.limit || 25,
          start: options.start || 0,
          expand: expandParam
        }
      });

      return {
        results: response.data.results.map(function(item: any) {
          return {
            content: item,
            title: item.title,
            excerpt: item.excerpt || '',
            url: item._links.webui,
            lastModified: item.version?.when || item.history?.lastUpdated?.when || ''
          };
        }),
        size: response.data.size,
        totalSize: response.data.totalSize
      };
    } catch (error: any) {
      throw new Error('Failed to search Confluence content: ' + (error.response?.data?.message || error.message));
    }
  }

  /**
   * Search pages by title
   */
  async searchByTitle(
    title: string,
    spaceKey?: string,
    options: {
      limit?: number;
    } = {}
  ): Promise<ConfluenceSearchResult> {
    var cql = 'type=page AND title~"' + title + '"';
    if (spaceKey) {
      cql += ' AND space=' + spaceKey;
    }

    return this.searchContent(cql, options);
  }

  // ===== LINK OPERATIONS =====

  /**
   * Add link between pages
   */
  async linkPages(
    sourcePageId: string,
    targetPageId: string,
    linkType: string = 'link'
  ): Promise<void> {
    try {
      // Get source page to update it with link
      var sourcePage = await this.getPage(sourcePageId, ['body.storage', 'version']);

      var linkHtml = '<ac:link><ri:page ri:content-title="' + targetPageId + '" /></ac:link>';
      var updatedContent = sourcePage.body?.storage?.value || '';
      updatedContent += '<p>' + linkHtml + '</p>';

      await this.updatePage(
        sourcePageId,
        sourcePage.title,
        updatedContent,
        sourcePage.version.number
      );
    } catch (error: any) {
      throw new Error('Failed to link Confluence pages: ' + error.message);
    }
  }

  // ===== FIELD MAPPING =====

  /**
   * Map Confluence page to ServiceNow knowledge article fields
   */
  mapToServiceNow(page: ConfluencePage): {
    short_description: string;
    text: string;
    kb_knowledge_base?: string;
    kb_category?: string;
    workflow_state: string;
    u_confluence_page_id: string;
    u_confluence_space_key: string;
    u_confluence_url: string;
    u_confluence_version: number;
  } {
    var workflowStateMap: Record<string, string> = {
      'current': 'published',
      'draft': 'draft',
      'archived': 'retired'
    };

    var workflowState = workflowStateMap[page.status] || 'draft';

    // Extract plain text from HTML content
    var content = page.body?.storage?.value || page.body?.view?.value || '';

    // Basic HTML stripping (for ServiceNow knowledge article)
    var plainText = content
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      short_description: page.title,
      text: content, // Keep HTML for rich text field
      kb_knowledge_base: page.space.key,
      kb_category: page.space.name,
      workflow_state: workflowState,
      u_confluence_page_id: page.id,
      u_confluence_space_key: page.space.key,
      u_confluence_url: this.baseUrl + page._links.webui,
      u_confluence_version: page.version.number
    };
  }
}

export default ConfluenceClient;
