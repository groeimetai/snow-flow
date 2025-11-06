# Machine Learning Tools - Moved to Enterprise

**Status:** ⚠️ **MIGRATED TO ENTERPRISE** (November 6, 2025)

## Migration Notice

All ML tools have been migrated to the **Enterprise tier** (`snow-flow-enterprise` repository).

### Why the Move?

Machine Learning is a **premium enterprise feature** comparable to:
- ServiceNow Predictive Intelligence ($100k+/year)
- Salesforce Einstein ($50-75/user/month)
- Microsoft Dynamics 365 AI ($40-60/user/month)

Snow-Flow Enterprise includes ML at a fraction of the cost (80% savings).

---

## What Was Moved?

**Track 1: ServiceNow PI Integration (5 tools)**
- `pi_create_solution` - Create PI solution IN ServiceNow
- `pi_train_solution` - Train PI model
- `pi_activate_solution` - Activate trained model
- `pi_monitor_training` - Monitor training progress
- `pi_list_solutions` - List all PI solutions

**Track 2: TensorFlow.js Local (9 tools)**
- `ml_train_incident_classifier` - Train LSTM neural network locally
- `ml_classify_incident` - Predict with local model
- `ml_train_anomaly_detector` - Train anomaly detection
- `ml_detect_anomalies` - Detect anomalies
- `ml_train_change_risk` - Train change risk model
- `ml_predict_change_risk` - Predict change risk
- `ml_forecast_incidents` - Forecast volume
- `ml_performance_analytics` - ServiceNow PA integration
- `ml_hybrid_recommendation` - Ensemble predictions

**Total:** 14 ML tools moved to enterprise

---

## How to Access ML Tools

### Option 1: Enterprise License (Recommended)

Purchase a Snow-Flow Enterprise license to access all ML tools:

```bash
# Install enterprise MCP proxy
npx @snow-flow/mcp-proxy --license-key SNOW-ENT-YOUR-LICENSE
```

**Benefits:**
- ✅ All 14 ML tools (Track 1 + 2)
- ✅ 15 advanced Cloud ML tools (Q1 2026, Track 3)
- ✅ Jira/Azure/Confluence integrations
- ✅ Process Mining (4 tools)
- ✅ Stakeholder seats included FREE

**Pricing:** ~80% cheaper than ServiceNow Predictive Intelligence

Contact: enterprise@snow-flow.dev

### Option 2: Build Your Own (Open Source)

The ML tools were built using **open source technologies**:

**Track 1 (ServiceNow PI):**
- ServiceNow REST API (`/api/now/table/ml_solution_definition`)
- Requires Predictive Intelligence plugin license from ServiceNow

**Track 2 (TensorFlow.js Local):**
- TensorFlow.js (`@tensorflow/tfjs`)
- Node.js runtime
- Local model training/serving

You can implement similar functionality using these technologies in your own codebase.

---

## 3-Track ML Strategy

Snow-Flow Enterprise uses a **hybrid ML approach**:

1. **Track 1:** ServiceNow PI integration (for customers with PI license)
2. **Track 2:** TensorFlow.js local (offline, privacy-friendly)
3. **Track 3:** Cloud ML service (15 advanced tools, Q1 2026)

This gives customers **flexibility** to choose the best approach for their needs.

---

## Alternative: ServiceNow Native Features

If you don't want Enterprise, consider ServiceNow's native features:

1. **Predictive Intelligence** - $100k+/year
   - https://www.servicenow.com/products/predictive-intelligence.html

2. **Performance Analytics** - Included with many licenses
   - Time series data, trends, forecasting

3. **Virtual Agent** - Includes some ML capabilities
   - Natural language processing
   - Intent classification

---

## Open Source Alternatives

For development/testing, consider these open source options:

**Machine Learning:**
- TensorFlow.js - https://www.tensorflow.org/js
- Brain.js - https://brain.js.org/
- ML5.js - https://ml5js.org/

**Anomaly Detection:**
- Isolation Forest (Python) - https://scikit-learn.org/
- Prophet (Time Series) - https://facebook.github.io/prophet/

**Forecasting:**
- Prophet - https://facebook.github.io/prophet/
- NeuralProphet - https://neuralprophet.com/

---

## Questions?

- **Enterprise Sales:** enterprise@snow-flow.dev
- **Technical Support:** support@snow-flow.dev
- **Documentation:** https://docs.snow-flow.dev

---

**Last Updated:** November 6, 2025
**Migration Date:** November 6, 2025
**Enterprise Version:** 2.0.0+
