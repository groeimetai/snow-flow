/**
 * ServiceNow Machine Learning MCP Server
 * Real neural networks and machine learning for ServiceNow operations
 */
import { ServiceNowCredentials } from '../utils/snow-oauth.js';
export declare class ServiceNowMachineLearningMCP {
    private server;
    private logger;
    private client;
    private incidentClassifier?;
    private changeRiskPredictor?;
    private incidentVolumePredictor?;
    private anomalyDetector?;
    private modelCache;
    private embeddingCache;
    private hasPA;
    private hasPI;
    private mlAPICheckComplete;
    constructor(credentials?: ServiceNowCredentials);
    private initializeModels;
    private loadOrCreateModels;
    private setupHandlers;
    /**
     * Train incident classification neural network
     * Uses PI if available, otherwise uses custom TensorFlow.js
     */
    private trainIncidentClassifier;
    /**
     * Train change risk prediction model
     */
    private trainChangeRiskModel;
    /**
     * Train anomaly detection autoencoder
     */
    private trainAnomalyDetector;
    /**
     * Classify incident using PI if available, otherwise neural network
     */
    /**
     * Classify an incident using trained ML model
     */
    private classifyIncident;
    /**
     * Helper: Suggest assignment group based on category
     */
    private suggestAssignmentGroup;
    /**
     * Helper: Suggest priority based on category and description
     */
    private suggestPriority;
    /**
     * Helper: Generate category description
     */
    private generateCategoryDescription;
    /**
     * Forecast incident volume using LSTM
     */
    private forecastIncidents;
    /**
     * Get model status and metrics
     */
    private getModelStatus;
    private fetchIncidentData;
    private prepareIncidentData;
    private tokenizeText;
    private getModelSize;
    private generateCategoryRecommendation;
    private generateVolumeRecommendations;
    private loadIncidentClassifier;
    private loadChangeRiskModel;
    private loadTimeSeriesModel;
    private loadAnomalyDetector;
    private fetchChangeData;
    private prepareChangeData;
    private fetchMetricData;
    private fetchIncidentVolumeHistory;
    private prepareTimeSeriesData;
    private fetchSingleIncident;
    /**
     * Train model using streaming to handle large datasets efficiently
     */
    private trainWithStreaming;
    /**
     * Fetch a batch of incidents with offset for streaming
     */
    private fetchIncidentBatch;
    /**
     * Create feature hasher for memory-efficient vocabulary management
     */
    private createFeatureHasher;
    /**
     * Process batch with feature hashing
     */
    private processBatchWithHashing;
    /**
     * Create optimized model for memory efficiency
     */
    private createOptimizedModel;
    /**
     * Create optimized model with specific number of categories
     */
    private createOptimizedModelWithCategories;
    /**
     * Optimized data preparation with feature hashing
     */
    private prepareIncidentDataOptimized;
    private detectAnomalies;
    private predictChangeRisk;
    private evaluateModel;
    /**
     * ServiceNow Native ML Integration Methods
     */
    private performanceAnalytics;
    private predictiveIntelligence;
    private agentIntelligence;
    private processOptimization;
    private virtualAgentNLU;
    private hybridRecommendation;
    private generateHybridRecommendation;
    private makeServiceNowRequest;
    private checkMLAPIAvailability;
    run(): Promise<void>;
    private calculateForecast;
    private calculateTrend;
    private detectSeasonality;
    private calculateVariance;
    private detectAnomaliesInPA;
    private detectChangePoints;
    private extractBreakdownData;
    private generateProcessOptimizations;
}
//# sourceMappingURL=servicenow-machine-learning-mcp.d.ts.map