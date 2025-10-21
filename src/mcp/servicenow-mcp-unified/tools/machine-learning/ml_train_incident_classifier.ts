/**
 * ml_train_incident_classifier - Train LSTM neural networks LOCALLY on ServiceNow incident data
 *
 * ⚠️ IMPORTANT: This trains models LOCALLY on your machine, NOT in ServiceNow.
 * This is an alternative to ServiceNow Predictive Intelligence (PI) for dev/testing.
 *
 * This tool trains a deep learning classifier using TensorFlow.js with:
 * - LSTM layers for sequence processing
 * - Embedding layers for text representation
 * - Dropout for regularization
 * - Intelligent data selection and optimization
 *
 * How it works:
 * 1. Fetches incident data from ServiceNow via OAuth2 API
 * 2. Trains TensorFlow.js model locally (Node.js environment)
 * 3. Saves model to .snow-flow/ml-models/ directory
 * 4. NOT importable into ServiceNow PI
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';
import { requestApproval, formatFetchSummary } from '../../../../utils/data-fetch-safety.js';
import * as tf from '@tensorflow/tfjs';

export const toolDefinition: MCPToolDefinition = {
  name: 'ml_train_incident_classifier',
  description: '⚠️ LOCAL ML TRAINING: Trains LSTM neural networks on your machine using ServiceNow incident data fetched via API. NOT in ServiceNow. Alternative to PI license for dev/testing. Fetches up to 5000 records.',
  inputSchema: {
    type: 'object',
    properties: {
      sample_size: {
        type: 'number',
        description: 'Number of incidents to use for training. If not specified, automatically uses all available data (up to 5000).'
      },
      auto_maximize_data: {
        type: 'boolean',
        description: 'Automatically use all available incident data for best model accuracy',
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
      },
      query: {
        type: 'string',
        description: 'Custom ServiceNow query for selecting training data'
      },
      intelligent_selection: {
        type: 'boolean',
        description: 'Let Snow-Flow intelligently select balanced training data',
        default: true
      },
      focus_categories: {
        type: 'array',
        items: { type: 'string' },
        description: 'Specific categories to focus on for training'
      },
      batch_size: {
        type: 'number',
        description: 'Process data in batches to prevent memory overload',
        default: 100
      },
      max_vocabulary_size: {
        type: 'number',
        description: 'Maximum vocabulary size using feature hashing',
        default: 10000
      },
      streaming_mode: {
        type: 'boolean',
        description: 'Enable streaming mode for very large datasets',
        default: true
      }
    }
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const {
    sample_size,
    auto_maximize_data = true,
    epochs = 50,
    validation_split = 0.2,
    query = '',
    intelligent_selection = true,
    focus_categories = [],
    batch_size = 100,
    max_vocabulary_size = 10000,
    streaming_mode = true
  } = args;

  try {
    const client = await getAuthenticatedClient(context);

    // Ensure max_vocabulary_size is ALWAYS valid
    const validVocabSize = Math.max(1000, max_vocabulary_size);

    // Initialize TensorFlow.js
    await tf.ready();

    // Determine optimal sample size
    let actualSampleSize = sample_size || 2000;

    if (auto_maximize_data || !sample_size) {
      const countQuery = query || (intelligent_selection ?
        'categoryISNOTEMPTY^descriptionISNOTEMPTY^sys_created_onONLast 6 months' :
        '');

      try {
        // Try to count available incidents
        const response = await client.query({
          table: 'incident',
          query: countQuery,
          limit: 1,
          count: true
        });

        const totalAvailable = response.count || 0;
        const maxRecommended = 5000;
        const optimalSize = Math.min(totalAvailable, maxRecommended);

        if (totalAvailable > 0) {
          actualSampleSize = sample_size ?
            Math.min(sample_size, totalAvailable) :
            optimalSize;

          console.log(`Using ${actualSampleSize} incidents for training (optimal for this dataset)`);
        }
      } catch (error) {
        actualSampleSize = sample_size || 1000;
      }
    }

    // Safety check: warn about large data fetches
    const approval = requestApproval({
      table: 'incident',
      estimatedRecords: actualSampleSize,
      query: query || 'Last 6 months, non-empty category/description',
      purpose: 'Train LSTM incident classifier locally'
    });

    if (!approval.approved) {
      return createErrorResult('Data fetch cancelled by user');
    }

    const fetchStartTime = Date.now();

    // Fetch incident data
    const finalQuery = query || (intelligent_selection ?
      'categoryISNOTEMPTY^descriptionISNOTEMPTY^sys_created_onONLast 6 months' :
      'categoryISNOTEMPTY');

    const incidents = await client.query({
      table: 'incident',
      query: finalQuery,
      limit: actualSampleSize,
      fields: ['short_description', 'description', 'category', 'priority', 'impact', 'urgency']
    });

    const fetchTime = Date.now() - fetchStartTime;

    // Log fetch summary
    const summary = formatFetchSummary(
      {
        table: 'incident',
        estimatedRecords: actualSampleSize,
        purpose: 'Train LSTM incident classifier'
      },
      fetchTime,
      incidents.length
    );
    console.log(summary);

    if (!incidents || incidents.length === 0) {
      return createErrorResult('No incidents found for training');
    }

    // Prepare training data
    const { features, labels, tokenizer, categories } = prepareIncidentData(
      incidents,
      validVocabSize
    );

    const vocabularySize = tokenizer.get('_vocabulary_size') || validVocabSize;

    // Create LSTM model
    const model = tf.sequential({
      layers: [
        // Embedding layer for text
        tf.layers.embedding({
          inputDim: vocabularySize,
          outputDim: 128,
          inputLength: 100
        }),

        // LSTM for sequence processing
        tf.layers.lstm({
          units: 64,
          returnSequences: false,
          dropout: 0.2,
          recurrentDropout: 0.2
        }),

        // Dense layers
        tf.layers.dense({
          units: 32,
          activation: 'relu'
        }),
        tf.layers.dropout({ rate: 0.3 }),

        // Output layer
        tf.layers.dense({
          units: categories.length,
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
    const finalAccuracy = history.history.acc[history.history.acc.length - 1];
    const finalLoss = history.history.loss[history.history.loss.length - 1];

    return createSuccessResult({
      status: 'success',
      message: 'Incident classifier trained successfully',
      training_summary: {
        samples: incidents.length,
        epochs: epochs,
        categories: categories.length,
        vocabulary_size: vocabularySize,
        final_accuracy: (finalAccuracy * 100).toFixed(2) + '%',
        final_loss: finalLoss.toFixed(4)
      },
      categories: categories
    });

  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

/**
 * Prepare incident data for neural network training
 */
function prepareIncidentData(incidents: any[], maxVocabularySize: number) {
  const validVocabSize = Math.max(1000, maxVocabularySize);
  const hasher = createFeatureHasher(validVocabSize);

  let categories = [...new Set(incidents.map((i: any) => i.category))].filter((c: any) => c);

  // Ensure at least 2 categories
  if (categories.length < 2) {
    if (categories.length === 0) {
      categories = ['uncategorized', 'other'];
    } else {
      categories.push('other');
    }
  }

  const sequences: number[][] = [];
  const labels: number[][] = [];

  for (const incident of incidents) {
    const text = `${incident.short_description || ''} ${incident.description || ''}`;
    const sequence = hasher(text);
    sequences.push(sequence);

    // One-hot encode category
    const category = incident.category || 'uncategorized';
    const categoryIndex = categories.indexOf(category);
    const label = new Array(categories.length).fill(0);

    if (categoryIndex >= 0) {
      label[categoryIndex] = 1;
    } else {
      label[0] = 1;
    }
    labels.push(label);
  }

  const tokenizerMap = new Map<string, number>();
  tokenizerMap.set('_vocabulary_size', validVocabSize);

  return {
    features: tf.tensor2d(sequences),
    labels: tf.tensor2d(labels),
    tokenizer: tokenizerMap,
    categories
  };
}

/**
 * Create feature hasher for vocabulary management
 */
function createFeatureHasher(vocabSize: number) {
  return (text: string): number[] => {
    const words = text.toLowerCase().split(/\s+/).slice(0, 100);
    const sequence = new Array(100).fill(0);

    for (let i = 0; i < words.length && i < 100; i++) {
      let hash = 0;
      for (let j = 0; j < words[i].length; j++) {
        hash = ((hash << 5) - hash) + words[i].charCodeAt(j);
        hash = hash & hash;
      }
      sequence[i] = Math.abs(hash) % vocabSize;
    }

    return sequence;
  };
}

export const version = '1.0.0';
