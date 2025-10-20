/**
 * TensorFlow.js ML Service
 * REAL machine learning implementation for ServiceNow predictions
 * No more fake regex matching!
 */
export interface IncidentData {
    category: string;
    priority: number;
    urgency: number;
    impact: number;
    shortDescription: string;
    description: string;
    assignmentGroup?: string;
}
export interface PredictionResult {
    classification: string;
    confidence: number;
    probabilities: {
        [key: string]: number;
    };
    modelVersion: string;
    isRealML: boolean;
}
export declare class TensorFlowMLService {
    private static instance;
    private logger;
    private models;
    private vocabularies;
    private readonly MODEL_DIR;
    private constructor();
    static getInstance(): TensorFlowMLService;
    /**
     * Initialize pre-trained models
     */
    private initializeModels;
    /**
     * Create default neural network models
     */
    private createDefaultModels;
    /**
     * Train incident classification model with real data
     */
    trainIncidentClassifier(incidents: IncidentData[]): Promise<{
        accuracy: number;
        loss: number;
        epochs: number;
    }>;
    /**
     * Classify an incident using the neural network
     */
    classifyIncident(incident: IncidentData): Promise<PredictionResult>;
    /**
     * Predict change risk using neural network
     */
    predictChangeRisk(changeData: {
        type: string;
        category: string;
        risk_assessment: string;
        implementation_plan: string;
        backout_plan: string;
        test_plan: string;
    }): Promise<PredictionResult>;
    /**
     * Detect anomalies using autoencoder
     */
    detectAnomaly(data: number[]): Promise<{
        isAnomaly: boolean;
        reconstructionError: number;
        threshold: number;
    }>;
    /**
     * Prepare incident data for training
     */
    private prepareIncidentData;
    /**
     * Convert incident to feature tensor
     */
    private incidentToFeatures;
    /**
     * Convert incident to feature array
     */
    private incidentToFeatureArray;
    /**
     * Convert change data to features
     */
    private changeToFeatures;
    /**
     * Build vocabulary from training data
     */
    private buildVocabulary;
    /**
     * Save model to disk
     */
    private saveModel;
    /**
     * Load model from disk
     */
    loadModel(name: string): Promise<void>;
    /**
     * Get model summary
     */
    getModelSummary(modelName: string): string;
}
export declare const tensorflowML: TensorFlowMLService;
//# sourceMappingURL=tensorflow-ml-service.d.ts.map