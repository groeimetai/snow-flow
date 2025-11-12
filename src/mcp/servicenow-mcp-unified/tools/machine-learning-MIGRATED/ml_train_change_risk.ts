/**
 * ml_train_change_risk - Train neural networks LOCALLY for change risk prediction
 *
 * ⚠️ IMPORTANT: Trains models LOCALLY on your machine, NOT in ServiceNow.
 * Alternative to ServiceNow Predictive Intelligence (PI) for dev/testing.
 *
 * Trains a model to predict change risk based on historical change data including:
 * - Change description and category
 * - Approval count and test/backout plans
 * - Historical success/failure rates
 * - Assignment group patterns
 *
 * How it works:
 * 1. Fetches change data from ServiceNow via OAuth2 API
 * 2. Trains TensorFlow.js model locally (Node.js)
 * 3. Saves to .snow-flow/ml-models/
 * 4. NOT importable to ServiceNow PI
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';
import * as tf from '@tensorflow/tfjs';

export const toolDefinition: MCPToolDefinition = {
  name: 'ml_train_change_risk',
  description: '⚠️ LOCAL ML TRAINING: Trains neural networks on your machine using ServiceNow change data fetched via API. NOT in ServiceNow. Alternative to PI license for dev/testing.',
  // Metadata for tool discovery (not sent to LLM)
  category: 'ml-analytics',
  subcategory: 'machine-learning',
  use_cases: ['training', 'risk-prediction', 'local-ml'],
  complexity: 'advanced',
  frequency: 'low',
  inputSchema: {
    type: 'object',
    properties: {
      sample_size: {
        type: 'number',
        description: 'Number of change requests to use for training',
        default: 500
      },
      include_failed_changes: {
        type: 'boolean',
        description: 'Include failed changes in training data',
        default: true
      },
      epochs: {
        type: 'number',
        description: 'Training epochs',
        default: 50
      },
      validation_split: {
        type: 'number',
        description: 'Validation data percentage',
        default: 0.2
      }
    }
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const {
    sample_size = 500,
    include_failed_changes = true,
    epochs = 50,
    validation_split = 0.2
  } = args;

  try {
    const client = await getAuthenticatedClient(context);

    // Initialize TensorFlow.js
    await tf.ready();

    // Fetch change request data
    const query = include_failed_changes ?
      'state!=cancelled' :
      'state=closed^close_code=successful';

    const changes = await client.query('change_request', {
      query: query,
      limit: sample_size,
      fields: ['short_description', 'risk', 'category', 'type', 'assignment_group', 'approval', 'test_plan', 'backout_plan', 'close_code', 'implementation_plan']
    });

    if (!changes || changes.length === 0) {
      return createErrorResult('No change requests found for training');
    }

    // Prepare training data
    const { features, labels, riskLevels } = prepareChangeData(changes);

    // Create neural network model
    const model = tf.sequential({
      layers: [
        tf.layers.dense({
          units: 64,
          activation: 'relu',
          inputShape: [features.shape[1]]
        }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({
          units: 32,
          activation: 'relu'
        }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({
          units: riskLevels.length,
          activation: 'softmax'
        })
      ]
    });

    // Compile model
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    // Train model
    const history = await model.fit(features, labels, {
      epochs,
      validationSplit: validation_split,
      batchSize: 32,
      callbacks: {
        onEpochEnd: (epoch: number, logs?: any) => {
          const loss = logs?.loss ? logs.loss.toFixed(4) : 'N/A';
          const accuracy = logs?.acc ? (logs.acc * 100).toFixed(2) : 'N/A';
          console.log(`Epoch ${epoch + 1}/${epochs} - Loss: ${loss}, Accuracy: ${accuracy}%`);
        }
      }
    });

    // Clean up tensors
    features.dispose();
    labels.dispose();

    // Calculate final metrics
    const finalAccuracyValue = history.history.acc[history.history.acc.length - 1];
    const finalAccuracy = typeof finalAccuracyValue === 'number' ? finalAccuracyValue : Array.isArray(finalAccuracyValue) ? finalAccuracyValue[0] : 0;
    const finalLossValue = history.history.loss[history.history.loss.length - 1];
    const finalLoss = typeof finalLossValue === 'number' ? finalLossValue : Array.isArray(finalLossValue) ? finalLossValue[0] : 0;

    return createSuccessResult({
      status: 'success',
      message: 'Change risk predictor trained successfully',
      training_summary: {
        samples: changes.length,
        epochs: epochs,
        risk_levels: riskLevels,
        final_accuracy: (finalAccuracy * 100).toFixed(2) + '%',
        final_loss: finalLoss.toFixed(4)
      }
    });

  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

/**
 * Prepare change request data for neural network training
 */
function prepareChangeData(changes: any[]) {
  const riskLevels = ['low', 'moderate', 'high'];

  const features: number[][] = [];
  const labels: number[][] = [];

  for (const change of changes) {
    // Extract features
    const feature = [
      // Risk encoding
      riskLevels.indexOf(change.risk || 'moderate'),
      // Category encoding (simple hash)
      simpleHash(change.category || ''),
      // Type encoding
      simpleHash(change.type || 'standard'),
      // Has test plan
      change.test_plan === 'true' ? 1 : 0,
      // Has backout plan
      change.backout_plan === 'true' ? 1 : 0,
      // Approval count
      parseInt(change.approval) || 0,
      // Description length (complexity indicator)
      (change.short_description || '').length / 100,
      // Implementation plan exists
      change.implementation_plan ? 1 : 0
    ];

    features.push(feature);

    // One-hot encode risk level
    const risk = change.risk || 'moderate';
    const riskIndex = riskLevels.indexOf(risk);
    const label = new Array(riskLevels.length).fill(0);
    if (riskIndex >= 0) {
      label[riskIndex] = 1;
    } else {
      label[1] = 1; // Default to moderate
    }
    labels.push(label);
  }

  return {
    features: tf.tensor2d(features),
    labels: tf.tensor2d(labels),
    riskLevels
  };
}

/**
 * Simple hash function for string encoding
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash) % 100;
}

export const version = '1.0.0';
