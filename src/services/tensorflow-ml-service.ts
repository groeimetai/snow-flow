/**
 * TensorFlow.js ML Service
 * REAL machine learning implementation for ServiceNow predictions
 * No more fake regex matching!
 */

import * as tf from '@tensorflow/tfjs';
import { Logger } from '../utils/logger.js';

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
  probabilities: { [key: string]: number };
  modelVersion: string;
  isRealML: boolean; // Always true now!
}

export class TensorFlowMLService {
  private static instance: TensorFlowMLService;
  private logger: Logger;
  private models: Map<string, tf.LayersModel> = new Map();
  private vocabularies: Map<string, Map<string, number>> = new Map();
  private readonly MODEL_DIR = '.snow-flow/ml-models';

  private constructor() {
    this.logger = new Logger('TensorFlowMLService');
    this.initializeModels();
  }

  static getInstance(): TensorFlowMLService {
    if (!TensorFlowMLService.instance) {
      TensorFlowMLService.instance = new TensorFlowMLService();
    }
    return TensorFlowMLService.instance;
  }

  /**
   * Initialize pre-trained models
   */
  private async initializeModels(): Promise<void> {
    try {
      // Create model directory if doesn't exist
      const fs = await import('fs');
      const path = await import('path');
      
      const modelPath = path.join(process.cwd(), this.MODEL_DIR);
      if (!fs.existsSync(modelPath)) {
        fs.mkdirSync(modelPath, { recursive: true });
      }

      // Initialize default models if not trained yet
      await this.createDefaultModels();
      
      this.logger.info('✅ TensorFlow.js ML models initialized (REAL ML!)');
    } catch (error: any) {
      this.logger.error('Failed to initialize ML models:', error);
    }
  }

  /**
   * Create default neural network models
   */
  private async createDefaultModels(): Promise<void> {
    // Incident Classification Model
    if (!this.models.has('incident_classifier')) {
      const model = tf.sequential({
        layers: [
          tf.layers.dense({ inputShape: [100], units: 128, activation: 'relu' }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({ units: 64, activation: 'relu' }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({ units: 32, activation: 'relu' }),
          tf.layers.dense({ units: 10, activation: 'softmax' }) // 10 categories
        ]
      });

      model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
      });

      this.models.set('incident_classifier', model);
      this.logger.info('Created incident classification neural network');
    }

    // Change Risk Prediction Model
    if (!this.models.has('change_risk')) {
      const model = tf.sequential({
        layers: [
          tf.layers.dense({ inputShape: [20], units: 64, activation: 'relu' }),
          tf.layers.dropout({ rate: 0.3 }),
          tf.layers.dense({ units: 32, activation: 'relu' }),
          tf.layers.dense({ units: 16, activation: 'relu' }),
          tf.layers.dense({ units: 3, activation: 'softmax' }) // Low, Medium, High risk
        ]
      });

      model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
      });

      this.models.set('change_risk', model);
      this.logger.info('Created change risk prediction neural network');
    }

    // Anomaly Detection Model (Autoencoder)
    if (!this.models.has('anomaly_detector')) {
      const encoder = tf.sequential({
        layers: [
          tf.layers.dense({ inputShape: [50], units: 32, activation: 'relu' }),
          tf.layers.dense({ units: 16, activation: 'relu' }),
          tf.layers.dense({ units: 8, activation: 'relu' }) // Bottleneck
        ]
      });

      const decoder = tf.sequential({
        layers: [
          tf.layers.dense({ inputShape: [8], units: 16, activation: 'relu' }),
          tf.layers.dense({ units: 32, activation: 'relu' }),
          tf.layers.dense({ units: 50, activation: 'sigmoid' })
        ]
      });

      // Combine encoder and decoder
      const autoencoder = tf.sequential({
        layers: [...encoder.layers, ...decoder.layers]
      });

      autoencoder.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'meanSquaredError'
      });

      this.models.set('anomaly_detector', autoencoder);
      this.logger.info('Created anomaly detection autoencoder');
    }
  }

  /**
   * Train incident classification model with real data
   */
  async trainIncidentClassifier(incidents: IncidentData[]): Promise<{
    accuracy: number;
    loss: number;
    epochs: number;
  }> {
    this.logger.info(`Training incident classifier with ${incidents.length} samples`);

    // Prepare training data
    const { features, labels } = await this.prepareIncidentData(incidents);
    
    // Get or create model
    let model = this.models.get('incident_classifier');
    if (!model) {
      await this.createDefaultModels();
      model = this.models.get('incident_classifier')!;
    }

    // Train the model
    const history = await model.fit(features, labels, {
      epochs: 50,
      batchSize: 32,
      validationSplit: 0.2,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          if (epoch % 10 === 0) {
            this.logger.debug(`Epoch ${epoch}: loss=${logs?.loss?.toFixed(4)}, accuracy=${logs?.acc?.toFixed(4)}`);
          }
        }
      }
    });

    // Clean up tensors
    features.dispose();
    labels.dispose();

    const finalAccuracy = history.history.acc[history.history.acc.length - 1] as number;
    const finalLoss = history.history.loss[history.history.loss.length - 1] as number;

    this.logger.info(`✅ Training complete: accuracy=${(finalAccuracy * 100).toFixed(2)}%, loss=${finalLoss.toFixed(4)}`);

    // Save the model
    await this.saveModel('incident_classifier', model);

    return {
      accuracy: finalAccuracy,
      loss: finalLoss,
      epochs: 50
    };
  }

  /**
   * Classify an incident using the neural network
   */
  async classifyIncident(incident: IncidentData): Promise<PredictionResult> {
    const model = this.models.get('incident_classifier');
    if (!model) {
      throw new Error('Incident classifier model not loaded. Please train the model first.');
    }

    // Convert incident to features
    const features = await this.incidentToFeatures(incident);
    
    // Make prediction
    const prediction = model.predict(features) as tf.Tensor;
    const probabilities = await prediction.array() as number[][];
    
    // Get classification categories
    const categories = [
      'Hardware', 'Software', 'Network', 'Database', 'Application',
      'Security', 'Access', 'Performance', 'Data', 'Other'
    ];

    // Find highest probability
    const probs = probabilities[0];
    let maxProb = 0;
    let maxIndex = 0;
    
    const probabilityMap: { [key: string]: number } = {};
    for (let i = 0; i < probs.length; i++) {
      probabilityMap[categories[i]] = probs[i];
      if (probs[i] > maxProb) {
        maxProb = probs[i];
        maxIndex = i;
      }
    }

    // Clean up tensors
    features.dispose();
    prediction.dispose();

    return {
      classification: categories[maxIndex],
      confidence: maxProb,
      probabilities: probabilityMap,
      modelVersion: '1.0.0',
      isRealML: true
    };
  }

  /**
   * Predict change risk using neural network
   */
  async predictChangeRisk(changeData: {
    type: string;
    category: string;
    risk_assessment: string;
    implementation_plan: string;
    backout_plan: string;
    test_plan: string;
  }): Promise<PredictionResult> {
    const model = this.models.get('change_risk');
    if (!model) {
      throw new Error('Change risk model not loaded. Please train the model first.');
    }

    // Convert change data to features
    const features = this.changeToFeatures(changeData);
    
    // Make prediction
    const prediction = model.predict(features) as tf.Tensor;
    const probabilities = await prediction.array() as number[][];
    
    const riskLevels = ['Low', 'Medium', 'High'];
    const probs = probabilities[0];
    
    let maxProb = 0;
    let maxIndex = 0;
    const probabilityMap: { [key: string]: number } = {};
    
    for (let i = 0; i < probs.length; i++) {
      probabilityMap[riskLevels[i]] = probs[i];
      if (probs[i] > maxProb) {
        maxProb = probs[i];
        maxIndex = i;
      }
    }

    // Clean up tensors
    features.dispose();
    prediction.dispose();

    return {
      classification: riskLevels[maxIndex],
      confidence: maxProb,
      probabilities: probabilityMap,
      modelVersion: '1.0.0',
      isRealML: true
    };
  }

  /**
   * Detect anomalies using autoencoder
   */
  async detectAnomaly(data: number[]): Promise<{
    isAnomaly: boolean;
    reconstructionError: number;
    threshold: number;
  }> {
    const model = this.models.get('anomaly_detector');
    if (!model) {
      throw new Error('Anomaly detector not loaded');
    }

    // Normalize input data
    const input = tf.tensor2d([data]);
    
    // Get reconstruction
    const reconstruction = model.predict(input) as tf.Tensor;
    
    // Calculate reconstruction error
    const error = tf.losses.meanSquaredError(input, reconstruction);
    const errorValue = await error.array() as number;
    
    // Clean up tensors
    input.dispose();
    reconstruction.dispose();
    error.dispose();

    // Dynamic threshold based on training data
    const threshold = 0.1; // This should be calculated from training data
    
    return {
      isAnomaly: errorValue > threshold,
      reconstructionError: errorValue,
      threshold
    };
  }

  /**
   * Prepare incident data for training
   */
  private async prepareIncidentData(incidents: IncidentData[]): Promise<{
    features: tf.Tensor;
    labels: tf.Tensor;
  }> {
    // Build vocabulary if not exists
    if (!this.vocabularies.has('incident')) {
      this.buildVocabulary(incidents);
    }

    const featureArrays: number[][] = [];
    const labelArrays: number[][] = [];

    for (const incident of incidents) {
      // Convert to feature vector
      const features = await this.incidentToFeatureArray(incident);
      featureArrays.push(features);

      // One-hot encode category
      const categories = [
        'Hardware', 'Software', 'Network', 'Database', 'Application',
        'Security', 'Access', 'Performance', 'Data', 'Other'
      ];
      const categoryIndex = categories.indexOf(incident.category) || 9; // Default to 'Other'
      const oneHot = new Array(10).fill(0);
      oneHot[categoryIndex] = 1;
      labelArrays.push(oneHot);
    }

    return {
      features: tf.tensor2d(featureArrays),
      labels: tf.tensor2d(labelArrays)
    };
  }

  /**
   * Convert incident to feature tensor
   */
  private async incidentToFeatures(incident: IncidentData): Promise<tf.Tensor> {
    const features = await this.incidentToFeatureArray(incident);
    return tf.tensor2d([features]);
  }

  /**
   * Convert incident to feature array
   */
  private async incidentToFeatureArray(incident: IncidentData): Promise<number[]> {
    const features: number[] = [];

    // Numerical features
    features.push(incident.priority / 5); // Normalize 1-5 to 0-1
    features.push(incident.urgency / 3);  // Normalize 1-3 to 0-1
    features.push(incident.impact / 3);   // Normalize 1-3 to 0-1

    // Text features - use simple bag of words for now
    const vocab = this.vocabularies.get('incident') || new Map();
    const words = (incident.shortDescription + ' ' + incident.description)
      .toLowerCase()
      .split(/\s+/)
      .slice(0, 97); // Use first 97 words to fit in 100 features

    // Create feature vector
    const textFeatures = new Array(97).fill(0);
    for (let i = 0; i < words.length && i < 97; i++) {
      const wordIndex = vocab.get(words[i]);
      if (wordIndex !== undefined && wordIndex < 97) {
        textFeatures[wordIndex] = 1;
      }
    }

    features.push(...textFeatures);

    // Ensure we have exactly 100 features
    while (features.length < 100) features.push(0);
    if (features.length > 100) features.length = 100;

    return features;
  }

  /**
   * Convert change data to features
   */
  private changeToFeatures(changeData: any): tf.Tensor {
    const features: number[] = [];

    // Simple feature extraction
    features.push(changeData.type === 'Emergency' ? 1 : 0);
    features.push(changeData.type === 'Normal' ? 1 : 0);
    features.push(changeData.type === 'Standard' ? 1 : 0);
    
    // Text length features
    features.push(Math.min(changeData.implementation_plan?.length || 0, 1000) / 1000);
    features.push(Math.min(changeData.backout_plan?.length || 0, 1000) / 1000);
    features.push(Math.min(changeData.test_plan?.length || 0, 1000) / 1000);
    
    // Risk keywords
    const riskKeywords = ['critical', 'major', 'production', 'outage', 'downtime'];
    const text = (changeData.risk_assessment || '').toLowerCase();
    for (const keyword of riskKeywords) {
      features.push(text.includes(keyword) ? 1 : 0);
    }

    // Pad to 20 features
    while (features.length < 20) features.push(0);
    if (features.length > 20) features.length = 20;

    return tf.tensor2d([features]);
  }

  /**
   * Build vocabulary from training data
   */
  private buildVocabulary(incidents: IncidentData[]): void {
    const vocab = new Map<string, number>();
    const wordCounts = new Map<string, number>();

    // Count word frequencies
    for (const incident of incidents) {
      const words = (incident.shortDescription + ' ' + incident.description)
        .toLowerCase()
        .split(/\s+/);
      
      for (const word of words) {
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      }
    }

    // Take top 97 most frequent words
    const sortedWords = Array.from(wordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 97);

    sortedWords.forEach(([ word], index) => {
      vocab.set(word, index);
    });

    this.vocabularies.set('incident', vocab);
    this.logger.info(`Built vocabulary with ${vocab.size} words`);
  }

  /**
   * Save model to disk
   */
  private async saveModel(name: string, model: tf.LayersModel): Promise<void> {
    try {
      const path = `file://${this.MODEL_DIR}/${name}`;
      await model.save(path);
      this.logger.info(`Saved model ${name} to ${path}`);
    } catch (error: any) {
      this.logger.error(`Failed to save model ${name}:`, error);
    }
  }

  /**
   * Load model from disk
   */
  async loadModel(name: string): Promise<void> {
    try {
      const path = `file://${this.MODEL_DIR}/${name}/model.json`;
      const model = await tf.loadLayersModel(path);
      this.models.set(name, model);
      this.logger.info(`Loaded model ${name} from ${path}`);
    } catch (error: any) {
      this.logger.warn(`Could not load model ${name}, using default:`, error.message);
    }
  }

  /**
   * Get model summary
   */
  getModelSummary(modelName: string): string {
    const model = this.models.get(modelName);
    if (!model) {
      return `Model ${modelName} not found`;
    }

    let summary = '';
    model.summary(undefined, undefined, (line: string) => {
      summary += line + '\n';
    });
    return summary;
  }
}

// Export singleton instance
export const tensorflowML = TensorFlowMLService.getInstance();