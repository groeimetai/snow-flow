"use strict";
/**
 * ServiceNow Widget Template Generator
 * Generates functional ServiceNow Service Portal widget templates based on requirements
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.widgetTemplateGenerator = exports.ServiceNowWidgetTemplateGenerator = void 0;
class ServiceNowWidgetTemplateGenerator {
    /**
     * Generate complete widget components based on instruction
     */
    generateWidget(options) {
        const { instruction = '', title = 'Widget', type = 'auto' } = options;
        const detectedType = type === 'auto' ? this.detectWidgetType(instruction) : type;
        const widgetTitle = title || this.extractTitleFromInstruction(instruction);
        const components = {
            template: this.generateTemplate(detectedType, widgetTitle, instruction),
            css: this.generateCss(detectedType, options),
            serverScript: this.generateServerScript(detectedType, instruction),
            clientScript: this.generateClientScript(detectedType, instruction),
            optionSchema: this.generateOptionSchema(detectedType),
            coherenceReport: {}
        };
        // Generate coherence report
        components.coherenceReport = this.validateCoherence(components);
        return components;
    }
    /**
     * Detect widget type from instruction
     */
    detectWidgetType(instruction) {
        const lower = instruction.toLowerCase();
        if (lower.includes('chart') || lower.includes('graph') || lower.includes('analytics')) {
            return 'chart';
        }
        if (lower.includes('dashboard') || lower.includes('metrics') || lower.includes('kpi')) {
            return 'dashboard';
        }
        if (lower.includes('table') || lower.includes('list') || lower.includes('records')) {
            return 'table';
        }
        if (lower.includes('form') || lower.includes('input') || lower.includes('create') || lower.includes('submit')) {
            return 'form';
        }
        return 'info'; // Default to info card widget
    }
    /**
     * Extract widget title from instruction
     */
    extractTitleFromInstruction(instruction) {
        // Simple extraction - look for patterns like "create X widget" or "X dashboard"
        const patterns = [
            /create\s+(.+?)\s+widget/i,
            /(.+?)\s+dashboard/i,
            /(.+?)\s+chart/i,
            /(.+?)\s+table/i,
            /(.+?)\s+form/i
        ];
        for (const pattern of patterns) {
            const match = instruction.match(pattern);
            if (match) {
                return match[1].replace(/\b\w/g, l => l.toUpperCase());
            }
        }
        // Fallback: use first few words
        const words = instruction.split(' ').slice(0, 3);
        return words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
    /**
     * Generate HTML template based on widget type
     */
    generateTemplate(type, title, instruction) {
        switch (type) {
            case 'chart':
                return this.generateChartTemplate(title);
            case 'dashboard':
                return this.generateDashboardTemplate(title);
            case 'table':
                return this.generateTableTemplate(title);
            case 'form':
                return this.generateFormTemplate(title);
            case 'info':
            default:
                return this.generateInfoTemplate(title, instruction);
        }
    }
    /**
     * Chart widget template with Chart.js integration
     */
    generateChartTemplate(title) {
        return `
<div class="panel panel-default widget-chart">
  <div class="panel-heading">
    <h3 class="panel-title">{{data.title || '${title}'}}</h3>
    <div class="panel-actions" ng-if="options.show_refresh">
      <button class="btn btn-sm btn-default" ng-click="c.refreshData()" title="Refresh Chart">
        <i class="fa fa-refresh" ng-class="{'fa-spin': data.loading}"></i>
      </button>
    </div>
  </div>
  <div class="panel-body">
    <div ng-if="data.loading" class="text-center loading-state">
      <i class="fa fa-spinner fa-spin fa-2x"></i>
      <p class="text-muted">Loading chart data...</p>
    </div>
    
    <div ng-if="!data.loading && !data.error" class="chart-container">
      <canvas id="chart-{{::widget.id}}" width="400" height="300"></canvas>
      
      <!-- Chart Legend -->
      <div ng-if="data.chart_legend" class="chart-legend">
        <div class="legend-item" ng-repeat="item in data.chart_legend">
          <span class="legend-color" style="background-color: {{item.color}}"></span>
          <span class="legend-label">{{item.label}}: {{item.value}}</span>
        </div>
      </div>
    </div>
    
    <div ng-if="data.error" class="alert alert-danger">
      <i class="fa fa-exclamation-triangle"></i>
      <strong>Chart Error:</strong> {{data.error}}
    </div>
    
    <div ng-if="!data.loading && !data.error && (!data.chart_data || data.chart_data.length === 0)" class="empty-state text-center">
      <i class="fa fa-bar-chart fa-3x text-muted"></i>
      <h4>No Data Available</h4>
      <p class="text-muted">{{data.empty_message || 'No chart data to display'}}</p>
    </div>
  </div>
</div>`.trim();
    }
    /**
     * Dashboard widget template with metrics
     */
    generateDashboardTemplate(title) {
        return `
<div class="widget-dashboard">
  <div class="panel panel-default">
    <div class="panel-heading">
      <h3 class="panel-title">{{data.title || '${title}'}}</h3>
      <span class="panel-subtitle" ng-if="data.last_updated">
        Last updated: {{data.last_updated | date:'medium'}}
      </span>
    </div>
    <div class="panel-body">
      <div ng-if="data.loading" class="text-center loading-state">
        <i class="fa fa-spinner fa-spin fa-2x"></i>
        <p class="text-muted">Loading dashboard data...</p>
      </div>
      
      <div ng-if="!data.loading && data.metrics && data.metrics.length > 0" class="metrics-grid">
        <div class="metric-item" ng-repeat="metric in data.metrics track by $index" 
             ng-class="'metric-col-' + (12/data.metrics.length)">
          <div class="metric-card" ng-class="{
            'metric-critical': metric.status === 'critical',
            'metric-warning': metric.status === 'warning', 
            'metric-success': metric.status === 'success',
            'metric-info': metric.status === 'info'
          }">
            <div class="metric-icon" ng-if="metric.icon">
              <i class="fa fa-{{metric.icon}}"></i>
            </div>
            <h4 class="metric-label">{{metric.label}}</h4>
            <div class="metric-value-container">
              <h2 class="metric-value">
                {{metric.value}} 
                <small ng-if="metric.unit" class="metric-unit">{{metric.unit}}</small>
              </h2>
              <div class="metric-trend" ng-if="metric.trend !== undefined">
                <i class="fa" ng-class="{
                  'fa-arrow-up text-success': metric.trend > 0,
                  'fa-arrow-down text-danger': metric.trend < 0,
                  'fa-minus text-muted': metric.trend === 0
                }"></i>
                <span class="trend-text">{{metric.trend_text || (metric.trend > 0 ? '+' + metric.trend + '%' : metric.trend + '%')}}</span>
              </div>
            </div>
            <div class="metric-description" ng-if="metric.description">
              {{metric.description}}
            </div>
          </div>
        </div>
      </div>
      
      <div ng-if="!data.loading && (!data.metrics || data.metrics.length === 0)" class="empty-state text-center">
        <i class="fa fa-dashboard fa-3x text-muted"></i>
        <h4>No Metrics Available</h4>
        <p class="text-muted">{{data.empty_message || 'Dashboard metrics will appear here'}}</p>
      </div>
    </div>
  </div>
</div>`.trim();
    }
    /**
     * Table widget template with sorting and filtering
     */
    generateTableTemplate(title) {
        return `
<div class="panel panel-default widget-table">
  <div class="panel-heading">
    <h3 class="panel-title">{{data.title || '${title}'}}</h3>
    <div class="panel-actions">
      <div class="input-group input-group-sm search-container" ng-if="options.enable_search">
        <input type="text" class="form-control" placeholder="Search records..." 
               ng-model="c.searchTerm" ng-change="c.onSearchChange()">
        <span class="input-group-btn">
          <button class="btn btn-default" ng-click="c.clearSearch()" ng-if="c.searchTerm">
            <i class="fa fa-times"></i>
          </button>
        </span>
      </div>
      <button class="btn btn-sm btn-primary" ng-click="c.refreshData()" title="Refresh Data">
        <i class="fa fa-refresh" ng-class="{'fa-spin': data.loading}"></i>
      </button>
    </div>
  </div>
  <div class="panel-body">
    <div ng-if="data.loading" class="text-center loading-state">
      <i class="fa fa-spinner fa-spin fa-2x"></i>
      <p class="text-muted">Loading records...</p>
    </div>
    
    <div ng-if="!data.loading && data.records && data.records.length > 0" class="table-container">
      <table class="table table-striped table-hover table-responsive">
        <thead>
          <tr>
            <th ng-repeat="column in data.columns" 
                ng-click="c.sortBy(column.field)" 
                class="sortable-header"
                ng-class="{'sorted': c.sortField === column.field}">
              {{column.label}}
              <span class="sort-indicator">
                <i class="fa fa-sort" ng-if="c.sortField !== column.field"></i>
                <i class="fa fa-sort-up" ng-if="c.sortField === column.field && !c.sortReverse"></i>
                <i class="fa fa-sort-down" ng-if="c.sortField === column.field && c.sortReverse"></i>
              </span>
            </th>
            <th ng-if="options.show_actions" class="actions-column">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr ng-repeat="record in data.records | filter:c.searchTerm | orderBy:c.sortField:c.sortReverse | limitTo:options.page_size track by record.sys_id" 
              ng-class="{'row-highlighted': record.highlighted}">
            <td ng-repeat="column in data.columns" ng-class="'column-' + column.type">
              <!-- Link fields -->
              <a ng-if="column.type === 'link'" 
                 href="{{record[column.field + '_link'] || '#'}}" 
                 target="_blank"
                 class="record-link">
                {{record[column.field] || '-'}}
              </a>
              
              <!-- Date fields -->
              <span ng-if="column.type === 'date'">
                {{record[column.field] | date:'short'}}
              </span>
              
              <!-- Status/State fields -->
              <span ng-if="column.type === 'status'" 
                    class="label"
                    ng-class="'label-' + (record[column.field + '_class'] || 'default')">
                {{record[column.field] || '-'}}
              </span>
              
              <!-- Default text fields -->
              <span ng-if="!column.type || (column.type !== 'link' && column.type !== 'date' && column.type !== 'status')">
                {{record[column.field] || '-'}}
              </span>
            </td>
            
            <td ng-if="options.show_actions" class="actions-column">
              <button class="btn btn-xs btn-default" ng-click="c.viewRecord(record)" title="View">
                <i class="fa fa-eye"></i>
              </button>
              <button class="btn btn-xs btn-primary" ng-click="c.editRecord(record)" title="Edit" ng-if="options.allow_edit">
                <i class="fa fa-edit"></i>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      
      <!-- Pagination -->
      <div ng-if="data.total_records > options.page_size" class="table-pagination text-center">
        <button class="btn btn-sm btn-default" ng-click="c.previousPage()" ng-disabled="c.currentPage <= 1">
          <i class="fa fa-chevron-left"></i> Previous
        </button>
        <span class="pagination-info">
          Page {{c.currentPage}} of {{c.totalPages}} ({{data.total_records}} total)
        </span>
        <button class="btn btn-sm btn-default" ng-click="c.nextPage()" ng-disabled="c.currentPage >= c.totalPages">
          Next <i class="fa fa-chevron-right"></i>
        </button>
      </div>
    </div>
    
    <div ng-if="!data.loading && (!data.records || data.records.length === 0)" class="empty-state text-center">
      <i class="fa fa-table fa-3x text-muted"></i>
      <h4>No Records Found</h4>
      <p class="text-muted">{{data.empty_message || 'No records match your criteria'}}</p>
    </div>
  </div>
</div>`.trim();
    }
    /**
     * Form widget template with validation
     */
    generateFormTemplate(title) {
        return `
<div class="panel panel-default widget-form">
  <div class="panel-heading">
    <h3 class="panel-title">{{data.title || '${title}'}}</h3>
  </div>
  <div class="panel-body">
    <div ng-if="data.success_message" class="alert alert-success alert-dismissible">
      <button type="button" class="close" ng-click="data.success_message = null">
        <span>&times;</span>
      </button>
      <i class="fa fa-check-circle"></i> {{data.success_message}}
    </div>
    
    <div ng-if="data.error_message" class="alert alert-danger alert-dismissible">
      <button type="button" class="close" ng-click="data.error_message = null">
        <span>&times;</span>
      </button>
      <i class="fa fa-exclamation-triangle"></i> {{data.error_message}}
    </div>
    
    <form name="widgetForm" ng-submit="c.submitForm()" novalidate class="widget-form">
      <div class="form-group" ng-repeat="field in data.form_fields" ng-class="{'has-error': widgetForm[field.name].$invalid && widgetForm[field.name].$touched}">
        <label class="control-label" for="{{field.name}}">
          {{field.label}}
          <span class="text-danger" ng-if="field.required">*</span>
          <span class="help-icon" ng-if="field.help_text" title="{{field.help_text}}">
            <i class="fa fa-question-circle"></i>
          </span>
        </label>
        
        <!-- Text Input -->
        <input ng-if="field.type === 'text' || !field.type" 
               type="text" 
               class="form-control" 
               id="{{field.name}}"
               name="{{field.name}}"
               ng-model="c.formData[field.name]"
               ng-required="field.required"
               placeholder="{{field.placeholder}}"
               maxlength="{{field.max_length}}">
        
        <!-- Email Input -->
        <input ng-if="field.type === 'email'" 
               type="email" 
               class="form-control" 
               id="{{field.name}}"
               name="{{field.name}}"
               ng-model="c.formData[field.name]"
               ng-required="field.required"
               placeholder="{{field.placeholder}}">
        
        <!-- Textarea -->
        <textarea ng-if="field.type === 'textarea'"
                  class="form-control"
                  id="{{field.name}}"
                  name="{{field.name}}"
                  ng-model="c.formData[field.name]"
                  ng-required="field.required"
                  placeholder="{{field.placeholder}}"
                  rows="{{field.rows || 3}}"
                  maxlength="{{field.max_length}}"></textarea>
        
        <!-- Select Dropdown -->
        <select ng-if="field.type === 'select'"
                class="form-control"
                id="{{field.name}}"
                name="{{field.name}}"
                ng-model="c.formData[field.name]"
                ng-required="field.required">
          <option value="">{{field.placeholder || 'Select ' + field.label}}</option>
          <option ng-repeat="option in field.options" value="{{option.value}}">{{option.label}}</option>
        </select>
        
        <!-- Checkbox -->
        <div ng-if="field.type === 'checkbox'" class="checkbox">
          <label>
            <input type="checkbox" 
                   id="{{field.name}}"
                   name="{{field.name}}"
                   ng-model="c.formData[field.name]"
                   ng-required="field.required">
            {{field.checkbox_label || field.label}}
          </label>
        </div>
        
        <!-- Date Input -->
        <input ng-if="field.type === 'date'" 
               type="date" 
               class="form-control" 
               id="{{field.name}}"
               name="{{field.name}}"
               ng-model="c.formData[field.name]"
               ng-required="field.required">
        
        <!-- Validation Messages -->
        <div class="form-field-errors" ng-if="widgetForm[field.name].$invalid && widgetForm[field.name].$touched">
          <small class="text-danger" ng-if="widgetForm[field.name].$error.required">
            {{field.label}} is required
          </small>
          <small class="text-danger" ng-if="widgetForm[field.name].$error.email">
            Please enter a valid email address
          </small>
          <small class="text-danger" ng-if="widgetForm[field.name].$error.maxlength">
            {{field.label}} is too long (max {{field.max_length}} characters)
          </small>
        </div>
        
        <div class="field-help-text" ng-if="field.help_text">
          <small class="text-muted">{{field.help_text}}</small>
        </div>
      </div>
      
      <div class="form-actions">
        <button type="submit" 
                class="btn btn-primary" 
                ng-disabled="widgetForm.$invalid || c.submitting">
          <i class="fa fa-spinner fa-spin" ng-if="c.submitting"></i>
          <i class="fa fa-check" ng-if="!c.submitting"></i>
          {{c.submitting ? (options.submit_text_loading || 'Submitting...') : (options.submit_text || 'Submit')}}
        </button>
        <button type="button" 
                class="btn btn-default" 
                ng-click="c.resetForm()"
                ng-if="options.show_reset">
          <i class="fa fa-undo"></i> Reset
        </button>
        <button type="button" 
                class="btn btn-link" 
                ng-click="c.cancelForm()"
                ng-if="options.show_cancel">
          Cancel
        </button>
      </div>
    </form>
  </div>
</div>`.trim();
    }
    /**
     * Info card widget template (default/generic)
     */
    generateInfoTemplate(title, instruction) {
        return `
<div class="panel panel-default widget-info">
  <div class="panel-heading">
    <h3 class="panel-title">{{data.title || '${title}'}}</h3>
    <div class="panel-actions" ng-if="options.show_refresh">
      <button class="btn btn-sm btn-default" ng-click="c.refreshData()" title="Refresh">
        <i class="fa fa-refresh" ng-class="{'fa-spin': data.loading}"></i>
      </button>
    </div>
  </div>
  <div class="panel-body">
    <div ng-if="data.loading" class="text-center loading-state">
      <i class="fa fa-spinner fa-spin fa-2x"></i>
      <p class="text-muted">Loading information...</p>
    </div>
    
    <div ng-if="!data.loading">
      <!-- Primary Content -->
      <div ng-if="data.content" class="widget-content">
        <div ng-if="data.content.icon" class="content-icon text-center">
          <i class="fa fa-{{data.content.icon}} fa-3x" ng-class="'text-' + (data.content.icon_color || 'primary')"></i>
        </div>
        
        <div ng-if="data.content.title" class="content-title">
          <h4>{{data.content.title}}</h4>
        </div>
        
        <div ng-if="data.content.description" class="content-description">
          <p ng-bind-html="data.content.description"></p>
        </div>
        
        <div ng-if="data.content.value" class="content-value text-center">
          <h2 class="value-display" ng-class="'text-' + (data.content.value_color || 'info')">
            {{data.content.value}}
            <small ng-if="data.content.unit">{{data.content.unit}}</small>
          </h2>
        </div>
      </div>
      
      <!-- List Items -->
      <div ng-if="data.items && data.items.length > 0" class="info-items">
        <div class="list-group">
          <div class="list-group-item info-item" ng-repeat="item in data.items track by $index"
               ng-class="'item-' + (item.type || 'default')">
            <div class="item-header" ng-if="item.title || item.icon">
              <div class="item-icon" ng-if="item.icon">
                <i class="fa fa-{{item.icon}}" ng-class="'text-' + (item.icon_color || 'default')"></i>
              </div>
              <div class="item-title" ng-if="item.title">
                <strong>{{item.title}}</strong>
              </div>
            </div>
            
            <div class="item-content">
              <div class="item-description" ng-if="item.description">
                {{item.description}}
              </div>
              
              <div class="item-value" ng-if="item.value">
                <span class="value" ng-class="'text-' + (item.value_color || 'default')">
                  {{item.value}}
                  <small ng-if="item.unit">{{item.unit}}</small>
                </span>
              </div>
            </div>
            
            <div class="item-meta" ng-if="item.timestamp || item.meta">
              <small class="text-muted">
                <span ng-if="item.timestamp">{{item.timestamp | date:'medium'}}</span>
                <span ng-if="item.meta">{{item.meta}}</span>
              </small>
            </div>
            
            <div class="item-actions" ng-if="item.actions && item.actions.length > 0">
              <button ng-repeat="action in item.actions" 
                      class="btn btn-xs"
                      ng-class="'btn-' + (action.type || 'default')"
                      ng-click="c.executeAction(action, item)">
                <i class="fa fa-{{action.icon}}" ng-if="action.icon"></i>
                {{action.label}}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Empty State -->
      <div ng-if="!data.content && (!data.items || data.items.length === 0)" class="empty-state text-center">
        <i class="fa fa-info-circle fa-3x text-muted"></i>
        <h4>{{data.empty_title || 'Information Widget'}}</h4>
        <p class="text-muted">{{data.empty_message || 'Widget data will appear here when available'}}</p>
      </div>
    </div>
  </div>
</div>`.trim();
    }
    /**
     * Generate CSS styles based on widget type and options
     */
    generateCss(type, options) {
        const { theme = 'default', responsive = true } = options;
        let css = `
/* Base Panel Styles */
.panel {
  margin-bottom: 20px;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  border: 1px solid #ddd;
}

.panel-heading {
  background: linear-gradient(to bottom, #f8f9fa 0%, #e9ecef 100%);
  border-bottom: 1px solid #dee2e6;
  position: relative;
  padding: 15px;
  border-radius: 5px 5px 0 0;
}

.panel-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #495057;
}

.panel-subtitle {
  font-size: 12px;
  color: #6c757d;
  display: block;
  margin-top: 4px;
}

.panel-actions {
  position: absolute;
  right: 15px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  gap: 8px;
  align-items: center;
}

.panel-body {
  padding: 15px;
}

/* Loading States */
.loading-state {
  padding: 40px 20px;
}

.loading-state .fa-spinner {
  color: #007bff;
  margin-bottom: 10px;
}

/* Empty States */
.empty-state {
  padding: 40px 20px;
}

.empty-state .fa {
  margin-bottom: 15px;
  opacity: 0.5;
}
`;
        // Add type-specific styles
        switch (type) {
            case 'chart':
                css += this.getChartCss();
                break;
            case 'dashboard':
                css += this.getDashboardCss();
                break;
            case 'table':
                css += this.getTableCss();
                break;
            case 'form':
                css += this.getFormCss();
                break;
            case 'info':
                css += this.getInfoCss();
                break;
        }
        // Add theme styles
        if (theme === 'dark') {
            css += this.getDarkThemeCss();
        }
        else if (theme === 'minimal') {
            css += this.getMinimalThemeCss();
        }
        // Add responsive styles
        if (responsive) {
            css += this.getResponsiveCss();
        }
        return css;
    }
    getChartCss() {
        return `
/* Chart Widget Styles */
.widget-chart canvas {
  max-width: 100%;
  height: auto;
}

.chart-container {
  position: relative;
}

.chart-legend {
  margin-top: 15px;
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  justify-content: center;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 5px;
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 2px;
}

.legend-label {
  font-size: 12px;
  color: #495057;
}
`;
    }
    getDashboardCss() {
        return `
/* Dashboard Widget Styles */
.metrics-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
}

.metric-item {
  flex: 1;
  min-width: 200px;
}

.metric-card {
  background: #fff;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  padding: 20px;
  text-align: center;
  transition: all 0.3s ease;
  height: 100%;
}

.metric-card:hover {
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
  transform: translateY(-2px);
}

.metric-card.metric-critical {
  border-left: 4px solid #dc3545;
}

.metric-card.metric-warning {
  border-left: 4px solid #ffc107;
}

.metric-card.metric-success {
  border-left: 4px solid #28a745;
}

.metric-card.metric-info {
  border-left: 4px solid #17a2b8;
}

.metric-icon {
  font-size: 24px;
  color: #6c757d;
  margin-bottom: 10px;
}

.metric-label {
  font-size: 14px;
  color: #6c757d;
  margin-bottom: 8px;
  font-weight: 500;
}

.metric-value {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 8px;
  line-height: 1;
}

.metric-unit {
  font-size: 14px;
  font-weight: 400;
  color: #6c757d;
}

.metric-trend {
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.trend-text {
  font-weight: 500;
}

.metric-description {
  font-size: 12px;
  color: #6c757d;
  margin-top: 8px;
}
`;
    }
    getTableCss() {
        return `
/* Table Widget Styles */
.search-container {
  max-width: 200px;
  margin-right: 8px;
}

.table-container {
  overflow-x: auto;
}

.table {
  margin-bottom: 0;
}

.sortable-header {
  cursor: pointer;
  user-select: none;
  position: relative;
}

.sortable-header:hover {
  background-color: #f8f9fa;
}

.sort-indicator {
  margin-left: 5px;
  opacity: 0.5;
}

.sorted .sort-indicator {
  opacity: 1;
}

.actions-column {
  width: 100px;
  text-align: center;
}

.record-link {
  color: #007bff;
  text-decoration: none;
}

.record-link:hover {
  text-decoration: underline;
}

.row-highlighted {
  background-color: #fff3cd !important;
}

.table-pagination {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #dee2e6;
}

.pagination-info {
  margin: 0 15px;
  color: #6c757d;
  font-size: 14px;
}

.column-status .label {
  font-size: 11px;
  padding: 3px 8px;
}

.label-critical { background-color: #dc3545; }
.label-warning { background-color: #ffc107; color: #212529; }
.label-success { background-color: #28a745; }
.label-info { background-color: #17a2b8; }
.label-default { background-color: #6c757d; }
`;
    }
    getFormCss() {
        return `
/* Form Widget Styles */
.widget-form {
  max-width: 600px;
}

.form-group {
  margin-bottom: 20px;
}

.control-label {
  font-weight: 500;
  margin-bottom: 5px;
  display: block;
}

.help-icon {
  color: #6c757d;
  cursor: help;
  margin-left: 4px;
}

.form-control {
  border-radius: 4px;
  border: 1px solid #ced4da;
  padding: 8px 12px;
  transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
}

.form-control:focus {
  border-color: #80bdff;
  box-shadow: 0 0 0 0.2rem rgba(0,123,255,.25);
}

.has-error .form-control {
  border-color: #dc3545;
}

.has-error .control-label {
  color: #dc3545;
}

.form-field-errors {
  margin-top: 5px;
}

.field-help-text {
  margin-top: 5px;
}

.form-actions {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid #dee2e6;
  display: flex;
  gap: 10px;
  align-items: center;
}

.checkbox label {
  font-weight: normal;
  margin-bottom: 0;
  cursor: pointer;
}
`;
    }
    getInfoCss() {
        return `
/* Info Widget Styles */
.widget-content {
  text-align: center;
  margin-bottom: 20px;
}

.content-icon {
  margin-bottom: 15px;
}

.content-title h4 {
  margin-bottom: 10px;
  color: #495057;
}

.content-description {
  color: #6c757d;
  margin-bottom: 15px;
}

.content-value {
  margin-bottom: 15px;
}

.value-display {
  font-weight: 700;
  margin-bottom: 0;
}

.info-items {
  margin-top: 20px;
}

.info-item {
  border: 1px solid #e9ecef;
  margin-bottom: 8px;
  padding: 12px;
  border-radius: 4px;
}

.item-header {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
  gap: 8px;
}

.item-icon {
  font-size: 16px;
}

.item-title {
  flex: 1;
}

.item-content {
  margin-bottom: 8px;
}

.item-description {
  color: #6c757d;
  margin-bottom: 5px;
}

.item-value .value {
  font-weight: 600;
}

.item-meta {
  margin-top: 8px;
}

.item-actions {
  margin-top: 8px;
  display: flex;
  gap: 5px;
}
`;
    }
    getDarkThemeCss() {
        return `
/* Dark Theme */
.panel {
  background-color: #343a40;
  border-color: #495057;
}

.panel-heading {
  background: linear-gradient(to bottom, #495057 0%, #343a40 100%);
  border-bottom-color: #495057;
}

.panel-title {
  color: #fff;
}

.panel-subtitle {
  color: #adb5bd;
}

.panel-body {
  background-color: #343a40;
  color: #fff;
}

.metric-card {
  background-color: #495057;
  border-color: #6c757d;
  color: #fff;
}

.table {
  color: #fff;
}

.table-striped tbody tr:nth-of-type(odd) {
  background-color: rgba(255,255,255,.05);
}
`;
    }
    getMinimalThemeCss() {
        return `
/* Minimal Theme */
.panel {
  border: none;
  box-shadow: none;
  background: transparent;
}

.panel-heading {
  background: transparent;
  border-bottom: 1px solid #dee2e6;
  padding: 10px 0;
}

.panel-title {
  font-size: 18px;
  font-weight: 300;
}

.panel-body {
  padding: 20px 0;
}

.metric-card {
  background: transparent;
  border: 1px solid #dee2e6;
  box-shadow: none;
}
`;
    }
    getResponsiveCss() {
        return `
/* Responsive Styles */
@media (max-width: 768px) {
  .panel-actions {
    position: static;
    transform: none;
    margin-top: 10px;
    text-align: right;
  }
  
  .metrics-grid {
    flex-direction: column;
  }
  
  .metric-item {
    min-width: auto;
  }
  
  .search-container {
    max-width: none;
    margin-bottom: 10px;
    margin-right: 0;
  }
  
  .table-pagination {
    text-align: center;
  }
  
  .pagination-info {
    display: block;
    margin: 10px 0;
  }
  
  .form-actions {
    flex-direction: column;
    align-items: stretch;
  }
  
  .form-actions .btn {
    margin-bottom: 5px;
  }
}

@media (max-width: 480px) {
  .panel-body {
    padding: 10px;
  }
  
  .metric-value {
    font-size: 24px;
  }
  
  .table-container {
    font-size: 14px;
  }
  
  .actions-column {
    width: 80px;
  }
  
  .btn-xs {
    padding: 2px 5px;
    font-size: 10px;
  }
}
`;
    }
    /**
     * Generate server script based on widget type
     */
    generateServerScript(type, instruction) {
        const baseScript = `
(function() {
  // Widget server script - runs server-side to fetch data
  var widgetType = '${type}';
  var instruction = '${instruction.replace(/'/g, "\\'")}';
  
  // Set widget title
  data.title = options.title || '${this.extractTitleFromInstruction(instruction)}';
  data.loading = false;
  data.error = null;
  
  try {
    // Widget-specific data loading
    switch(widgetType) {`;
        switch (type) {
            case 'chart':
                return baseScript + `
      case 'chart':
        loadChartData();
        break;
      case 'dashboard':
        loadDashboardData();
        break;
      case 'table':
        loadTableData();
        break;
      case 'form':
        loadFormData();
        break;
      default:
        loadInfoData();
    }
  } catch (e) {
    data.error = 'Server error: ' + e.message;
    gs.error('Widget server script error: ' + e.message);
  }
  
  function loadChartData() {
    // Sample chart data - replace with actual ServiceNow queries
    data.chart_data = [
      { label: 'Open', value: 25, color: '#dc3545' },
      { label: 'In Progress', value: 45, color: '#ffc107' },
      { label: 'Resolved', value: 30, color: '#28a745' }
    ];
    
    data.chart_legend = data.chart_data;
    data.chart_type = options.chart_type || 'doughnut';
    
    // Example: Load incident data
    // var gr = new GlideRecord('incident');
    // gr.addQuery('state', 'IN', '1,2,3');
    // gr.query();
    // data.chart_data = processIncidentData(gr);
  }
  
  function loadDashboardData() {
    data.metrics = [
      {
        label: 'Total Items',
        value: 150,
        unit: '',
        status: 'info',
        icon: 'list',
        trend: 5,
        trend_text: '+5%'
      },
      {
        label: 'Critical Issues',
        value: 3,
        unit: '',
        status: 'critical',
        icon: 'exclamation-triangle',
        trend: -2,
        trend_text: '-2 from yesterday'
      },
      {
        label: 'Success Rate',
        value: 98.5,
        unit: '%',
        status: 'success',
        icon: 'check-circle',
        trend: 1,
        trend_text: '+1%'
      }
    ];
    
    data.last_updated = new GlideDateTime().getDisplayValue();
  }
  
  function loadTableData() {
    data.columns = [
      { field: 'number', label: 'Number', type: 'link' },
      { field: 'short_description', label: 'Description', type: 'text' },
      { field: 'state', label: 'State', type: 'status' },
      { field: 'opened_at', label: 'Opened', type: 'date' }
    ];
    
    data.records = [];
    data.total_records = 0;
    
    // Example: Load incident records
    // var gr = new GlideRecord('incident');
    // gr.orderByDesc('opened_at');
    // gr.setLimit(options.page_size || 10);
    // gr.query();
    // 
    // while (gr.next()) {
    //   data.records.push({
    //     sys_id: gr.getUniqueValue(),
    //     number: gr.getDisplayValue('number'),
    //     number_link: '/' + gr.getTableName() + '.do?sys_id=' + gr.getUniqueValue(),
    //     short_description: gr.getDisplayValue('short_description'),
    //     state: gr.getDisplayValue('state'),
    //     state_class: getStateClass(gr.getValue('state')),
    //     opened_at: gr.getDisplayValue('opened_at')
    //   });
    // }
    // 
    // data.total_records = gr.getRowCount();
  }
  
  function loadFormData() {
    data.form_fields = [
      {
        name: 'title',
        label: 'Title',
        type: 'text',
        required: true,
        placeholder: 'Enter title...'
      },
      {
        name: 'description',
        label: 'Description',
        type: 'textarea',
        required: false,
        placeholder: 'Enter description...',
        rows: 3
      },
      {
        name: 'priority',
        label: 'Priority',
        type: 'select',
        required: true,
        options: [
          { value: '1', label: 'Critical' },
          { value: '2', label: 'High' },
          { value: '3', label: 'Medium' },
          { value: '4', label: 'Low' }
        ]
      }
    ];
  }
  
  function loadInfoData() {
    data.content = {
      icon: 'info-circle',
      icon_color: 'primary',
      title: 'Information Widget',
      description: 'This widget displays important information and updates.',
      value: null
    };
    
    data.items = [
      {
        title: 'Sample Information',
        description: 'This is sample information displayed in the widget.',
        icon: 'info',
        icon_color: 'info',
        timestamp: new GlideDateTime().getDisplayValue()
      }
    ];
  }
})();`.trim();
            default:
                return baseScript + `
      default:
        loadInfoData();
    }
  } catch (e) {
    data.error = 'Server error: ' + e.message;
    gs.error('Widget server script error: ' + e.message);
  }
  
  function loadInfoData() {
    data.content = {
      icon: 'info-circle',
      icon_color: 'primary',
      title: 'Information Widget',
      description: 'This widget displays important information and updates.',
      value: null
    };
    
    data.items = [
      {
        title: 'Sample Information',
        description: 'This is sample information displayed in the widget.',
        icon: 'info',
        icon_color: 'info',
        timestamp: new GlideDateTime().getDisplayValue()
      }
    ];
  }
})();`.trim();
        }
    }
    /**
     * Generate client script based on widget type
     */
    generateClientScript(type, instruction) {
        const baseScript = `
function($scope, $http, spUtil, $timeout) {
  var c = this;
  var widgetType = '${type}';
  
  // Initialize controller
  c.init = function() {
    c.widgetType = widgetType;
    c.loading = false;
    
    // Type-specific initialization
    switch(widgetType) {`;
        switch (type) {
            case 'chart':
                return baseScript + `
      case 'chart':
        c.initChart();
        break;
      case 'dashboard':
        c.initDashboard();
        break;
      case 'table':
        c.initTable();
        break;
      case 'form':
        c.initForm();
        break;
      default:
        c.initInfo();
    }
  };
  
  // Chart-specific functions
  c.initChart = function() {
    $timeout(function() {
      if (c.data.chart_data && c.data.chart_data.length > 0) {
        c.renderChart();
      }
    }, 100);
  };
  
  c.renderChart = function() {
    var canvas = document.getElementById('chart-' + c.widget.id);
    if (!canvas) return;
    
    var ctx = canvas.getContext('2d');
    var chartType = c.data.chart_type || 'doughnut';
    
    // Simple chart rendering (requires Chart.js)
    if (typeof Chart !== 'undefined') {
      new Chart(ctx, {
        type: chartType,
        data: {
          labels: c.data.chart_data.map(function(item) { return item.label; }),
          datasets: [{
            data: c.data.chart_data.map(function(item) { return item.value; }),
            backgroundColor: c.data.chart_data.map(function(item) { return item.color; })
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          legend: {
            display: false
          }
        }
      });
    }
  };
  
  c.refreshData = function() {
    c.loading = true;
    c.server.refresh().then(function() {
      c.loading = false;
      if (widgetType === 'chart') {
        $timeout(function() {
          c.renderChart();
        }, 100);
      }
    });
  };
  
  // Dashboard functions
  c.initDashboard = function() {
    // Dashboard initialization
  };
  
  // Table functions
  c.initTable = function() {
    c.currentPage = 1;
    c.sortField = null;
    c.sortReverse = false;
    c.searchTerm = '';
    c.calculatePagination();
  };
  
  c.sortBy = function(field) {
    if (c.sortField === field) {
      c.sortReverse = !c.sortReverse;
    } else {
      c.sortField = field;
      c.sortReverse = false;
    }
  };
  
  c.onSearchChange = function() {
    c.currentPage = 1;
    c.calculatePagination();
  };
  
  c.clearSearch = function() {
    c.searchTerm = '';
    c.onSearchChange();
  };
  
  c.calculatePagination = function() {
    var pageSize = c.options.page_size || 10;
    c.totalPages = Math.ceil((c.data.total_records || 0) / pageSize);
  };
  
  c.previousPage = function() {
    if (c.currentPage > 1) {
      c.currentPage--;
    }
  };
  
  c.nextPage = function() {
    if (c.currentPage < c.totalPages) {
      c.currentPage++;
    }
  };
  
  c.viewRecord = function(record) {
    // Navigate to record
    window.open('/' + record.sys_table + '.do?sys_id=' + record.sys_id, '_blank');
  };
  
  c.editRecord = function(record) {
    // Navigate to record form
    window.open('/' + record.sys_table + '.do?sys_id=' + record.sys_id, '_blank');
  };
  
  // Form functions
  c.initForm = function() {
    c.formData = {};
    c.submitting = false;
    c.resetForm();
  };
  
  c.submitForm = function() {
    if ($scope.widgetForm.$valid) {
      c.submitting = true;
      
      // Submit form data to server
      c.server.update().then(function(response) {
        c.submitting = false;
        if (response && response.success) {
          c.data.success_message = response.message || 'Form submitted successfully!';
          c.data.error_message = null;
          c.resetForm();
        } else {
          c.data.error_message = response.error || 'Form submission failed. Please try again.';
          c.data.success_message = null;
        }
      }).catch(function(error) {
        c.submitting = false;
        c.data.error_message = 'Network error. Please try again.';
        c.data.success_message = null;
      });
    }
  };
  
  c.resetForm = function() {
    c.formData = {};
    if ($scope.widgetForm) {
      $scope.widgetForm.$setPristine();
      $scope.widgetForm.$setUntouched();
    }
  };
  
  c.cancelForm = function() {
    c.resetForm();
    // Additional cancel logic
  };
  
  // Info widget functions
  c.initInfo = function() {
    // Info widget initialization
  };
  
  c.executeAction = function(action, item) {
    switch(action.type) {
      case 'link':
        window.open(action.url, '_blank');
        break;
      case 'refresh':
        c.refreshData();
        break;
      default:
        console.log('Action executed:', action, item);
    }
  };
  
  // Initialize widget
  c.init();
}`.trim();
            default:
                return baseScript + `
      default:
        c.initInfo();
    }
  };
  
  c.initInfo = function() {
    // Info widget initialization
  };
  
  c.refreshData = function() {
    c.loading = true;
    c.server.refresh().then(function() {
      c.loading = false;
    });
  };
  
  c.executeAction = function(action, item) {
    switch(action.type) {
      case 'link':
        window.open(action.url, '_blank');
        break;
      case 'refresh':
        c.refreshData();
        break;
      default:
        console.log('Action executed:', action, item);
    }
  };
  
  // Initialize widget
  c.init();
}`.trim();
        }
    }
    /**
     * Generate option schema based on widget type
     */
    generateOptionSchema(type) {
        const baseOptions = [
            {
                "name": "title",
                "label": "Widget Title",
                "type": "string",
                "value": ""
            },
            {
                "name": "show_refresh",
                "label": "Show Refresh Button",
                "type": "boolean",
                "value": true
            }
        ];
        let typeSpecificOptions = [];
        switch (type) {
            case 'chart':
                typeSpecificOptions = [
                    {
                        "name": "chart_type",
                        "label": "Chart Type",
                        "type": "choice",
                        "choices": [
                            { "label": "Doughnut", "value": "doughnut" },
                            { "label": "Bar", "value": "bar" },
                            { "label": "Line", "value": "line" },
                            { "label": "Pie", "value": "pie" }
                        ],
                        "value": "doughnut"
                    }
                ];
                break;
            case 'table':
                typeSpecificOptions = [
                    {
                        "name": "enable_search",
                        "label": "Enable Search",
                        "type": "boolean",
                        "value": true
                    },
                    {
                        "name": "page_size",
                        "label": "Records Per Page",
                        "type": "integer",
                        "value": 10
                    },
                    {
                        "name": "show_actions",
                        "label": "Show Action Buttons",
                        "type": "boolean",
                        "value": true
                    },
                    {
                        "name": "allow_edit",
                        "label": "Allow Edit Action",
                        "type": "boolean",
                        "value": false
                    }
                ];
                break;
            case 'form':
                typeSpecificOptions = [
                    {
                        "name": "submit_text",
                        "label": "Submit Button Text",
                        "type": "string",
                        "value": "Submit"
                    },
                    {
                        "name": "submit_text_loading",
                        "label": "Submit Button Loading Text",
                        "type": "string",
                        "value": "Submitting..."
                    },
                    {
                        "name": "show_reset",
                        "label": "Show Reset Button",
                        "type": "boolean",
                        "value": true
                    },
                    {
                        "name": "show_cancel",
                        "label": "Show Cancel Button",
                        "type": "boolean",
                        "value": false
                    }
                ];
                break;
        }
        const allOptions = [...baseOptions, ...typeSpecificOptions];
        return JSON.stringify(allOptions, null, 2);
    }
    /**
     * Validate widget coherence - ensures HTML, client script, and server script work together
     */
    validateCoherence(components) {
        const report = {
            isCoherent: true,
            dataProperties: { server: [], html: [], matched: [], missing: [] },
            methods: { html: [], client: [], matched: [], missing: [] },
            serverActions: { client: [], server: [], matched: [], missing: [] },
            warnings: [],
            suggestions: []
        };
        // Extract data properties from server script
        const serverDataMatches = components.serverScript.match(/data\.(\w+)\s*=/g) || [];
        report.dataProperties.server = serverDataMatches.map(match => match.replace(/data\.(\w+)\s*=/, '$1'));
        // Extract data properties from HTML template
        const htmlDataMatches = components.template.match(/\{\{data\.(\w+)[\}|\.]/g) || [];
        report.dataProperties.html = [...new Set(htmlDataMatches.map(match => match.replace(/\{\{data\.(\w+)[\}|\.].*/, '$1')))];
        // Find matched and missing data properties
        report.dataProperties.matched = report.dataProperties.server.filter(prop => report.dataProperties.html.includes(prop));
        report.dataProperties.missing = report.dataProperties.server.filter(prop => !report.dataProperties.html.includes(prop));
        // Extract methods from HTML (ng-click)
        const htmlMethodMatches = components.template.match(/ng-click="(\w+)\(/g) || [];
        report.methods.html = [...new Set(htmlMethodMatches.map(match => match.replace(/ng-click="(\w+)\(/, '$1')))];
        // Extract methods from client script ($scope.method)
        const clientMethodMatches = components.clientScript.match(/\$scope\.(\w+)\s*=/g) || [];
        report.methods.client = [...new Set(clientMethodMatches.map(match => match.replace(/\$scope\.(\w+)\s*=/, '$1')))];
        // Find matched and missing methods
        report.methods.matched = report.methods.html.filter(method => report.methods.client.includes(method));
        report.methods.missing = report.methods.html.filter(method => !report.methods.client.includes(method));
        // Extract client server actions
        const clientActionMatches = components.clientScript.match(/action:\s*['"](\w+)['"]/g) || [];
        report.serverActions.client = [...new Set(clientActionMatches.map(match => match.replace(/action:\s*['"](\w+)['"]/, '$1')))];
        // Extract server action handlers
        const serverActionMatches = components.serverScript.match(/input\.action\s*===?\s*['"](\w+)['"]/g) || [];
        report.serverActions.server = [...new Set(serverActionMatches.map(match => match.replace(/input\.action\s*===?\s*['"](\w+)['"]/, '$1')))];
        // Find matched and missing server actions
        report.serverActions.matched = report.serverActions.client.filter(action => report.serverActions.server.includes(action));
        report.serverActions.missing = report.serverActions.client.filter(action => !report.serverActions.server.includes(action));
        // Generate warnings and suggestions
        if (report.dataProperties.missing.length > 0) {
            report.warnings.push(`Server data properties not used in HTML: ${report.dataProperties.missing.join(', ')}`);
            report.suggestions.push(`Add {{data.${report.dataProperties.missing[0]}}} to HTML template`);
        }
        if (report.methods.missing.length > 0) {
            report.warnings.push(`HTML methods not implemented in client: ${report.methods.missing.join(', ')}`);
            report.suggestions.push(`Add $scope.${report.methods.missing[0]} = function() {} to client script`);
        }
        if (report.serverActions.missing.length > 0) {
            report.warnings.push(`Client actions not handled by server: ${report.serverActions.missing.join(', ')}`);
            report.suggestions.push(`Add if (input.action === '${report.serverActions.missing[0]}') {} to server script`);
        }
        // Additional coherence checks
        if (report.dataProperties.server.length === 0) {
            report.warnings.push('Server script does not set any data properties');
            report.suggestions.push('Add data.items = [] or similar in server script');
        }
        if (components.template.includes('ng-repeat') && !components.template.includes('{{')) {
            report.warnings.push('HTML has ng-repeat but no data bindings');
            report.suggestions.push('Add {{item.property}} bindings inside ng-repeat');
        }
        // Determine overall coherence
        report.isCoherent = report.warnings.length === 0;
        return report;
    }
}
exports.ServiceNowWidgetTemplateGenerator = ServiceNowWidgetTemplateGenerator;
// Export singleton instance
exports.widgetTemplateGenerator = new ServiceNowWidgetTemplateGenerator();
//# sourceMappingURL=widget-template-generator.js.map