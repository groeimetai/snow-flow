/**
 * ml_train_anomaly_detector - Train autoencoder neural networks for anomaly detection
 *
 * Trains an autoencoder model to detect anomalies in:
 * - Incident volume patterns
 * - Response time metrics
 * - Resource usage patterns
 *
 * Works without PA/PI licenses using standard table data
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';
import * as tf from '@tensorflow/tfjs-node';

export const toolDefinition: MCPToolDefinition = {
  name: 'ml_train_anomaly_detector',
  description: 'Trains autoencoder neural networks for anomaly detection in system metrics. Works without PA/PI licenses using standard table data.',
  inputSchema: {
    type: 'object',
    properties: {
      metric_type: {
        type: 'string',
        enum: ['incident_volume', 'response_time', 'resource_usage'],
        description: 'Type of metric to analyze for anomalies',
        default: 'incident_volume'
      },
      lookback_days: {
        type: 'number',
        description: 'Number of days to look back for training data',
        default: 90
      },
      epochs: {
        type: 'number',
        description: 'Training epochs',
        default: 50
      }
    }
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const {
    metric_type = 'incident_volume',
    lookback_days = 90,
    epochs = 50
  } = args;

  try {
    const client = await getAuthenticatedClient(context);

    // Initialize TensorFlow.js
    await tf.ready();

    // Fetch historical data
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - lookback_days);

    let tableName = '';
    let metricField = '';

    switch (metric_type) {
      case 'incident_volume':
        tableName = 'incident';
        metricField = 'sys_created_on';
        break;
      case 'response_time':
        tableName = 'incident';
        metricField = 'resolved_at';
        break;
      case 'resource_usage':
        tableName = 'sys_audit';
        metricField = 'sys_created_on';
        break;
      default:
        return createErrorResult(`Unsupported metric type: ${metric_type}`);
    }

    const query = `sys_created_on>=${startDate.toISOString()}^sys_created_on<=${endDate.toISOString()}`;

    const records = await client.query({
      table: tableName,
      query: query,
      limit: 100000,
      fields: [metricField, 'sys_created_on']
    });

    if (!records || records.length === 0) {
      return createErrorResult('No data found for training');
    }

    // Prepare time series data
    const dailyCounts = aggregateByDay(records, lookback_days);

    // Normalize data
    const normalizedData = normalizeData(dailyCounts);

    // Create autoencoder model
    const inputDim = 24; // Window size for pattern detection
    const encodingDim = 8; // Compressed representation

    // Encoder
    const encoder = tf.sequential({
      layers: [
        tf.layers.dense({
          units: 16,
          activation: 'relu',
          inputShape: [inputDim]
        }),
        tf.layers.dense({
          units: encodingDim,
          activation: 'relu'
        })
      ]
    });

    // Decoder
    const decoder = tf.sequential({
      layers: [
        tf.layers.dense({
          units: 16,
          activation: 'relu',
          inputShape: [encodingDim]
        }),
        tf.layers.dense({
          units: inputDim,
          activation: 'sigmoid'
        })
      ]
    });

    // Full autoencoder
    const autoencoder = tf.sequential({
      layers: [
        ...encoder.layers,
        ...decoder.layers
      ]
    });

    // Compile autoencoder
    autoencoder.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['mse']
    });

    // Prepare training windows
    const { features, labels } = prepareTimeSeriesWindows(normalizedData, inputDim);

    // Train model
    const history = await autoencoder.fit(features, labels, {
      epochs,
      batchSize: 32,
      validationSplit: 0.2,
      callbacks: {
        onEpochEnd: (epoch: number, logs?: any) => {
          const loss = logs?.loss ? logs.loss.toFixed(4) : 'N/A';
          console.log(`Epoch ${epoch + 1}/${epochs} - Loss: ${loss}`);
        }
      }
    });

    // Calculate anomaly threshold
    const predictions = autoencoder.predict(features) as tf.Tensor;
    const errors = tf.losses.meanSquaredError(labels, predictions);
    const errorArray = await errors.array();
    const threshold = calculateThreshold(errorArray as number[]);

    // Clean up tensors
    features.dispose();
    labels.dispose();
    predictions.dispose();
    errors.dispose();

    // Final metrics
    const finalLoss = history.history.loss[history.history.loss.length - 1];

    return createSuccessResult({
      status: 'success',
      message: 'Anomaly detector trained successfully',
      training_summary: {
        metric_type,
        samples: dailyCounts.length,
        epochs,
        window_size: inputDim,
        encoding_dimension: encodingDim,
        anomaly_threshold: threshold.toFixed(4),
        final_loss: finalLoss.toFixed(4)
      }
    });

  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

/**
 * Aggregate records by day
 */
function aggregateByDay(records: any[], days: number): number[] {
  const dailyCounts = new Array(days).fill(0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const record of records) {
    const recordDate = new Date(record.sys_created_on);
    const daysDiff = Math.floor((today.getTime() - recordDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff >= 0 && daysDiff < days) {
      dailyCounts[days - 1 - daysDiff]++;
    }
  }

  return dailyCounts;
}

/**
 * Normalize data to 0-1 range
 */
function normalizeData(data: number[]): number[] {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min;

  if (range === 0) return data.map(() => 0.5);

  return data.map(val => (val - min) / range);
}

/**
 * Prepare time series windows for training
 */
function prepareTimeSeriesWindows(data: number[], windowSize: number) {
  const features: number[][] = [];
  const labels: number[][] = [];

  for (let i = 0; i <= data.length - windowSize; i++) {
    const window = data.slice(i, i + windowSize);
    features.push(window);
    labels.push(window); // Autoencoder reconstructs input
  }

  return {
    features: tf.tensor2d(features),
    labels: tf.tensor2d(labels)
  };
}

/**
 * Calculate anomaly threshold (95th percentile)
 */
function calculateThreshold(errors: number[]): number {
  const sorted = errors.slice().sort((a, b) => a - b);
  const index = Math.floor(sorted.length * 0.95);
  return sorted[index];
}

export const version = '1.0.0';
