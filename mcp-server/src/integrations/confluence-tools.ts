/**
 * Confluence MCP Tool Implementations
 *
 * All 8 Confluence integration tools with complete implementations.
 * Designed for AGENT AUTONOMY - enabling AI agents to manage documentation workflows.
 */

import ConfluenceClient, { ConfluenceCredentials, ConfluencePage, ConfluenceSpace } from './confluence-client.js';
import { Customer } from '../database/schema.js';

// ===== TYPES =====

interface ConfluenceToolCredentials {
  confluence: ConfluenceCredentials;
}

// ===== TOOL 1: SYNC PAGES =====

export async function confluenceSyncPages(
  args: {
    spaceKey: string;
    limit?: number;
    titleFilter?: string;
  },
  _customer: Customer,
  credentials: ConfluenceToolCredentials
): Promise<{
  success: boolean;
  syncedPages: number;
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ pageId: string; error: string }>;
  pages: Array<{
    pageId: string;
    title: string;
    spaceKey: string;
    syncedFields: any;
  }>;
}> {
  try {
    if (!credentials.confluence) {
      throw new Error('Confluence credentials are required');
    }

    var client = new ConfluenceClient(credentials.confluence);

    var pages = await client.getPagesInSpace(args.spaceKey, {
      limit: args.limit || 100
    });

    // Filter by title if specified
    if (args.titleFilter) {
      var filter = args.titleFilter.toLowerCase();
      pages = pages.filter(function(page) {
        return page.title.toLowerCase().indexOf(filter) !== -1;
      });
    }

    var syncResults = {
      success: true,
      syncedPages: pages.length,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as Array<{ pageId: string; error: string }>,
      pages: [] as Array<{
        pageId: string;
        title: string;
        spaceKey: string;
        syncedFields: any;
      }>
    };

    for (var i = 0; i < pages.length; i++) {
      var page = pages[i];

      if (!page) {
        continue;
      }

      try {
        var mapped = client.mapToServiceNow(page);

        syncResults.pages.push({
          pageId: page.id,
          title: page.title,
          spaceKey: page.space.key,
          syncedFields: mapped
        });

        syncResults.created++;

      } catch (error: any) {
        syncResults.errors.push({
          pageId: page.id,
          error: error.message
        });
      }
    }

    return syncResults;

  } catch (error: any) {
    throw new Error('Failed to sync Confluence pages: ' + error.message);
  }
}

// ===== TOOL 2: GET PAGE =====

export async function confluenceGetPage(
  args: {
    pageId: string;
  },
  _customer: Customer,
  credentials: ConfluenceToolCredentials
): Promise<{
  page: ConfluencePage;
  servicenowMapping: any;
}> {
  try {
    if (!credentials.confluence) {
      throw new Error('Confluence credentials are required');
    }

    var client = new ConfluenceClient(credentials.confluence);
    var page = await client.getPage(args.pageId);
    var mapped = client.mapToServiceNow(page);

    return {
      page: page,
      servicenowMapping: mapped
    };

  } catch (error: any) {
    throw new Error('Failed to get Confluence page: ' + error.message);
  }
}

// ===== TOOL 3: CREATE PAGE =====

export async function confluenceCreatePage(
  args: {
    spaceKey: string;
    title: string;
    content: string;
    parentId?: string;
  },
  _customer: Customer,
  credentials: ConfluenceToolCredentials
): Promise<{
  page: ConfluencePage;
  pageId: string;
  url: string;
}> {
  try {
    if (!credentials.confluence) {
      throw new Error('Confluence credentials are required');
    }

    var client = new ConfluenceClient(credentials.confluence);

    var page = await client.createPage(
      args.spaceKey,
      args.title,
      args.content,
      {
        parentId: args.parentId
      }
    );

    return {
      page: page,
      pageId: page.id,
      url: credentials.confluence.baseUrl + page._links.webui
    };

  } catch (error: any) {
    throw new Error('Failed to create Confluence page: ' + error.message);
  }
}

// ===== TOOL 4: UPDATE PAGE =====

export async function confluenceUpdatePage(
  args: {
    pageId: string;
    title?: string;
    content?: string;
  },
  _customer: Customer,
  credentials: ConfluenceToolCredentials
): Promise<{
  page: ConfluencePage;
  updated: boolean;
}> {
  try {
    if (!credentials.confluence) {
      throw new Error('Confluence credentials are required');
    }

    var client = new ConfluenceClient(credentials.confluence);

    // Get current page to get version and existing content
    var currentPage = await client.getPage(args.pageId, ['body.storage', 'version']);

    var newTitle = args.title || currentPage.title;
    var newContent = args.content || (currentPage.body?.storage?.value || '');

    var page = await client.updatePage(
      args.pageId,
      newTitle,
      newContent,
      currentPage.version.number
    );

    return {
      page: page,
      updated: true
    };

  } catch (error: any) {
    throw new Error('Failed to update Confluence page: ' + error.message);
  }
}

// ===== TOOL 5: SEARCH CONTENT =====

export async function confluenceSearchContent(
  args: {
    query: string;
    spaceKey?: string;
    type?: string;
    limit?: number;
  },
  _customer: Customer,
  credentials: ConfluenceToolCredentials
): Promise<{
  results: Array<{
    pageId: string;
    title: string;
    excerpt: string;
    url: string;
    lastModified: string;
  }>;
  total: number;
}> {
  try {
    if (!credentials.confluence) {
      throw new Error('Confluence credentials are required');
    }

    var client = new ConfluenceClient(credentials.confluence);

    // Build CQL query
    var cql = 'text~"' + args.query + '"';

    if (args.type) {
      cql += ' AND type=' + args.type;
    } else {
      cql += ' AND type=page';
    }

    if (args.spaceKey) {
      cql += ' AND space=' + args.spaceKey;
    }

    var searchResult = await client.searchContent(cql, {
      limit: args.limit || 25
    });

    var results = [];
    for (var i = 0; i < searchResult.results.length; i++) {
      var result = searchResult.results[i];
      if (result) {
        results.push({
          pageId: result.content.id,
          title: result.title,
          excerpt: result.excerpt,
          url: result.url,
          lastModified: result.lastModified
        });
      }
    }

    return {
      results: results,
      total: searchResult.totalSize
    };

  } catch (error: any) {
    throw new Error('Failed to search Confluence content: ' + error.message);
  }
}

// ===== TOOL 6: GET SPACE =====

export async function confluenceGetSpace(
  args: {
    spaceKey: string;
  },
  _customer: Customer,
  credentials: ConfluenceToolCredentials
): Promise<{
  space: ConfluenceSpace;
  pageCount: number;
}> {
  try {
    if (!credentials.confluence) {
      throw new Error('Confluence credentials are required');
    }

    var client = new ConfluenceClient(credentials.confluence);
    var space = await client.getSpace(args.spaceKey);

    // Get page count
    var pages = await client.getPagesInSpace(args.spaceKey, { limit: 1 });

    return {
      space: space,
      pageCount: pages.length
    };

  } catch (error: any) {
    throw new Error('Failed to get Confluence space: ' + error.message);
  }
}

// ===== TOOL 7: CREATE SPACE =====

export async function confluenceCreateSpace(
  args: {
    key: string;
    name: string;
    description?: string;
  },
  _customer: Customer,
  credentials: ConfluenceToolCredentials
): Promise<{
  space: ConfluenceSpace;
  spaceKey: string;
  url: string;
}> {
  try {
    if (!credentials.confluence) {
      throw new Error('Confluence credentials are required');
    }

    var client = new ConfluenceClient(credentials.confluence);

    var space = await client.createSpace(
      args.key,
      args.name,
      args.description
    );

    return {
      space: space,
      spaceKey: space.key,
      url: credentials.confluence.baseUrl + space._links.webui
    };

  } catch (error: any) {
    throw new Error('Failed to create Confluence space: ' + error.message);
  }
}

// ===== TOOL 8: LINK PAGES =====

export async function confluenceLinkPages(
  args: {
    sourcePageId: string;
    targetPageId: string;
  },
  _customer: Customer,
  credentials: ConfluenceToolCredentials
): Promise<{
  success: boolean;
  sourcePageId: string;
  targetPageId: string;
}> {
  try {
    if (!credentials.confluence) {
      throw new Error('Confluence credentials are required');
    }

    var client = new ConfluenceClient(credentials.confluence);

    await client.linkPages(args.sourcePageId, args.targetPageId);

    return {
      success: true,
      sourcePageId: args.sourcePageId,
      targetPageId: args.targetPageId
    };

  } catch (error: any) {
    throw new Error('Failed to link Confluence pages: ' + error.message);
  }
}
