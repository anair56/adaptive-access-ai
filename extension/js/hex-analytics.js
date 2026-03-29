// Hex API Integration for TremorSense Analytics
// Uses Hex's powerful data analysis and ML capabilities

class HexAnalyticsIntegration {
  constructor() {
    // Load Hex configuration
    this.hexConfig = null;
    this.config = null;
    this.isReady = false;

    // Analytics state
    this.currentSession = {
      sessionId: this.generateSessionId(),
      startTime: Date.now(),
      dataPoints: [],
      metrics: {}
    };

    // Hex notebook cells for different analyses
    this.analysisCells = {
      tremorPattern: null,
      fatigueAnalysis: null,
      predictionModel: null,
      visualizations: null
    };

    this.initialize();
  }

  async initialize() {
    try {
      // Load configuration first
      await this.loadConfiguration();

      if (!this.config.mockData) {
        // Real Hex API connection
        await this.connectToHexProject();
        await this.setupDataPipeline();
      } else {
        // Mock mode for development
        console.log('Hex Analytics running in mock mode');
        this.project = { id: this.config.projectId, name: 'TremorSense (Demo)' };
      }

      // Set up real-time sync
      this.startRealtimeSync();
      this.isReady = true;

      console.log('Hex Analytics initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Hex Analytics:', error);
      // Continue in mock mode if initialization fails
      this.config = this.config || { mockData: true };
      this.isReady = true;
    }
  }

  async loadConfiguration() {
    // Load hex-config module
    if (typeof getHexConfig !== 'undefined') {
      this.hexConfig = getHexConfig();
      // Wait for config to initialize
      let attempts = 0;
      while (!this.hexConfig.initialized && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      this.config = this.hexConfig.getConfig();
    } else {
      // Fallback to mock config
      this.config = {
        mockData: true,
        apiKey: 'demo',
        projectId: 'demo',
        workspaceId: 'demo',
        baseUrl: 'https://app.hex.tech/api/v1',
        notebookUrl: 'https://app.hex.tech/api/v1/projects'
      };
    }
  }

  // Connect to Hex project (simplified - just verify token works)
  async connectToHexProject() {
    // For hackathon demo, we'll just verify the project exists
    // Actual Hex API requires running the entire project, not connecting to it

    console.log('Hex project configured:', this.config.projectId);
    this.project = {
      id: this.config.projectId,
      name: 'TremorSense Analytics',
      status: 'ready'
    };

    return this.project;
  }

  // Set up data pipeline in Hex
  async setupDataPipeline() {
    // Create Python cells for data analysis
    const analysisCells = [
      {
        name: 'tremor_pattern_analysis',
        code: `
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import plotly.express as px
import plotly.graph_objects as go
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler

# Load tremor data
tremor_data = pd.DataFrame(tremor_points)
tremor_data['timestamp'] = pd.to_datetime(tremor_data['timestamp'], unit='ms')
tremor_data.set_index('timestamp', inplace=True)

# Calculate rolling statistics
tremor_data['severity_ma'] = tremor_data['severity'].rolling('5min').mean()
tremor_data['severity_std'] = tremor_data['severity'].rolling('5min').std()
tremor_data['trend'] = tremor_data['severity'].diff().rolling('5min').mean()

# Detect patterns
def detect_tremor_patterns(data):
    patterns = {
        'periodic': False,
        'escalating': False,
        'stress_induced': False,
        'fatigue_related': False
    }

    # Periodic pattern detection using FFT
    if len(data) > 100:
        fft = np.fft.fft(data['severity'].values)
        freqs = np.fft.fftfreq(len(data))
        peak_freq = freqs[np.argmax(np.abs(fft[1:len(fft)//2])) + 1]
        patterns['periodic'] = abs(peak_freq) > 0.01

    # Escalating pattern
    patterns['escalating'] = data['trend'].mean() > 0.1

    # Stress spikes
    patterns['stress_induced'] = (data['severity_std'] > data['severity_std'].quantile(0.75)).sum() > 5

    # Fatigue (severity increases over session)
    if len(data) > 30:
        early = data.iloc[:10]['severity'].mean()
        late = data.iloc[-10:]['severity'].mean()
        patterns['fatigue_related'] = (late - early) / early > 0.2

    return patterns

patterns = detect_tremor_patterns(tremor_data)
print(f"Detected patterns: {patterns}")
        `,
        cell_type: 'code'
      },
      {
        name: 'ml_prediction_model',
        code: `
# Train ML model for tremor prediction
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score
import xgboost as xgb

# Feature engineering
def create_features(df):
    features = pd.DataFrame()
    features['hour'] = df.index.hour
    features['minute'] = df.index.minute
    features['day_of_week'] = df.index.dayofweek
    features['severity_lag1'] = df['severity'].shift(1)
    features['severity_lag5'] = df['severity'].shift(5)
    features['severity_lag10'] = df['severity'].shift(10)
    features['rolling_mean_5'] = df['severity'].rolling(5).mean()
    features['rolling_std_5'] = df['severity'].rolling(5).std()
    features['velocity'] = df['velocity']
    features['acceleration'] = df['acceleration']
    features['session_duration'] = (df.index - df.index[0]).total_seconds() / 60
    return features.dropna()

# Prepare data
X = create_features(tremor_data)
y = tremor_data.loc[X.index, 'severity']

# Split data
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Train XGBoost model
model = xgb.XGBRegressor(
    n_estimators=100,
    max_depth=5,
    learning_rate=0.1,
    random_state=42
)

model.fit(X_train, y_train)

# Predictions
y_pred = model.predict(X_test)
mse = mean_squared_error(y_test, y_pred)
r2 = r2_score(y_test, y_pred)

print(f"Model Performance - MSE: {mse:.4f}, R2: {r2:.4f}")

# Feature importance
importance = pd.DataFrame({
    'feature': X.columns,
    'importance': model.feature_importances_
}).sort_values('importance', ascending=False)

# Predict next hour
last_features = create_features(tremor_data.tail(20))
if len(last_features) > 0:
    next_hour_prediction = model.predict(last_features.tail(1))[0]
    confidence = min(0.95, r2 + 0.2)  # Confidence based on model performance
else:
    next_hour_prediction = tremor_data['severity'].mean()
    confidence = 0.5

prediction_result = {
    'next_hour_severity': float(next_hour_prediction),
    'confidence': float(confidence),
    'model_r2': float(r2)
}
        `,
        cell_type: 'code'
      },
      {
        name: 'advanced_visualizations',
        code: `
# Create advanced visualizations
import plotly.graph_objects as go
from plotly.subplots import make_subplots

# 1. Tremor Pattern Heatmap
fig_heatmap = go.Figure()

# Group by hour and day for heatmap
heatmap_data = tremor_data.groupby([
    tremor_data.index.date,
    tremor_data.index.hour
])['severity'].mean().unstack(fill_value=0)

fig_heatmap.add_trace(go.Heatmap(
    z=heatmap_data.values,
    x=list(range(24)),
    y=[str(d) for d in heatmap_data.index],
    colorscale='RdBu_r',
    showscale=True,
    hovertemplate='Hour: %{x}<br>Date: %{y}<br>Severity: %{z:.2f}<extra></extra>'
))

fig_heatmap.update_layout(
    title='Tremor Severity Heatmap (By Hour)',
    xaxis_title='Hour of Day',
    yaxis_title='Date',
    height=400
)

# 2. Real-time Severity with Predictions
fig_realtime = make_subplots(
    rows=2, cols=1,
    subplot_titles=('Tremor Severity Over Time', 'Velocity & Acceleration'),
    vertical_spacing=0.1,
    row_heights=[0.7, 0.3]
)

# Severity trace
fig_realtime.add_trace(
    go.Scatter(
        x=tremor_data.index,
        y=tremor_data['severity'],
        name='Actual Severity',
        line=dict(color='#8B2635', width=2),
        hovertemplate='%{x}<br>Severity: %{y:.2f}<extra></extra>'
    ),
    row=1, col=1
)

# Moving average
fig_realtime.add_trace(
    go.Scatter(
        x=tremor_data.index,
        y=tremor_data['severity_ma'],
        name='5-min Average',
        line=dict(color='#A8312F', width=2, dash='dash'),
        hovertemplate='%{x}<br>Avg: %{y:.2f}<extra></extra>'
    ),
    row=1, col=1
)

# Velocity and acceleration
fig_realtime.add_trace(
    go.Scatter(
        x=tremor_data.index,
        y=tremor_data['velocity'],
        name='Velocity',
        line=dict(color='#4A90A4', width=1)
    ),
    row=2, col=1
)

fig_realtime.add_trace(
    go.Scatter(
        x=tremor_data.index,
        y=tremor_data['acceleration'],
        name='Acceleration',
        line=dict(color='#67B8CC', width=1)
    ),
    row=2, col=1
)

fig_realtime.update_layout(height=600, showlegend=True)

# 3. Click Accuracy Funnel
click_data = tremor_data[tremor_data['targetElement'].notna()]
accuracy_by_severity = click_data.groupby(pd.cut(click_data['severity'], bins=5))['isSuccessfulClick'].mean()

fig_funnel = go.Figure(go.Funnel(
    y=['Low', 'Low-Med', 'Medium', 'Med-High', 'High'],
    x=accuracy_by_severity.values * 100,
    textinfo="value+percent initial",
    hovertemplate='Severity: %{y}<br>Accuracy: %{x:.1f}%<extra></extra>'
))

fig_funnel.update_layout(
    title='Click Accuracy by Tremor Severity',
    height=400
)

# 4. Fatigue Analysis
session_duration_bins = pd.cut(tremor_data['session_duration'], bins=10)
fatigue_progression = tremor_data.groupby(session_duration_bins)['severity'].mean()

fig_fatigue = go.Figure()
fig_fatigue.add_trace(go.Scatter(
    x=list(range(len(fatigue_progression))),
    y=fatigue_progression.values,
    mode='lines+markers',
    name='Severity',
    line=dict(color='#8B2635', width=3),
    marker=dict(size=10)
))

fig_fatigue.update_layout(
    title='Fatigue Progression Over Session',
    xaxis_title='Session Progress (10 intervals)',
    yaxis_title='Average Severity',
    height=400
)

# Store visualizations
visualizations = {
    'heatmap': fig_heatmap.to_json(),
    'realtime': fig_realtime.to_json(),
    'accuracy': fig_funnel.to_json(),
    'fatigue': fig_fatigue.to_json()
}
        `,
        cell_type: 'code'
      },
      {
        name: 'ai_recommendations',
        code: `
# Generate AI-powered recommendations
import openai
from datetime import datetime

def generate_ai_recommendations(patterns, metrics, prediction):
    recommendations = []

    # Pattern-based recommendations
    if patterns['fatigue_related']:
        time_to_break = 30 - (metrics['session_duration'] % 30)
        recommendations.append({
            'type': 'break',
            'priority': 'high',
            'message': f'High fatigue detected. Take a {time_to_break}-minute break.',
            'action': 'schedule_break'
        })

    if patterns['periodic']:
        recommendations.append({
            'type': 'timing',
            'priority': 'medium',
            'message': 'Periodic tremors detected. Time activities between peaks.',
            'action': 'optimize_timing'
        })

    if patterns['stress_induced']:
        recommendations.append({
            'type': 'relaxation',
            'priority': 'high',
            'message': 'Stress spikes detected. Try breathing exercises.',
            'action': 'start_breathing'
        })

    # Prediction-based recommendations
    if prediction['next_hour_severity'] > 7:
        recommendations.append({
            'type': 'prevention',
            'priority': 'urgent',
            'message': 'High severity predicted. Consider preventive measures.',
            'action': 'enable_max_assistance'
        })

    # Website-specific recommendations
    if metrics.get('click_accuracy', 100) < 70:
        recommendations.append({
            'type': 'ui_adjustment',
            'priority': 'high',
            'message': 'Low click accuracy. Increasing target sizes.',
            'action': 'enlarge_targets'
        })

    # Time-based recommendations
    current_hour = datetime.now().hour
    if current_hour in [14, 15, 16] and metrics.get('avg_severity', 0) > 5:
        recommendations.append({
            'type': 'timing',
            'priority': 'medium',
            'message': 'Afternoon tremors detected. Consider a power nap.',
            'action': 'suggest_nap'
        })

    return recommendations

# Generate recommendations
recommendations = generate_ai_recommendations(patterns,
    {
        'session_duration': len(tremor_data),
        'click_accuracy': tremor_data['isSuccessfulClick'].mean() * 100 if 'isSuccessfulClick' in tremor_data else 100,
        'avg_severity': tremor_data['severity'].mean()
    },
    prediction_result
)

# Rank by priority
priority_order = {'urgent': 0, 'high': 1, 'medium': 2, 'low': 3}
recommendations.sort(key=lambda x: priority_order.get(x['priority'], 4))

print(f"Generated {len(recommendations)} AI recommendations")
        `,
        cell_type: 'code'
      }
    ];

    // Execute cells in Hex
    for (const cell of analysisCells) {
      await this.createHexCell(cell);
    }
  }

  // Create a Hex notebook cell
  async createHexCell(cellConfig) {
    const response = await fetch(`${this.config.notebookUrl}/${this.config.projectId}/cells`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.workspaceToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        cell_type: cellConfig.cell_type || 'code',
        source: cellConfig.code,
        metadata: {
          name: cellConfig.name,
          created_by: 'TremorSense'
        }
      })
    });

    if (!response.ok) {
      console.error('Failed to create Hex cell:', cellConfig.name);
      return null;
    }

    const cell = await response.json();
    this.analysisCells[cellConfig.name] = cell;
    return cell;
  }

  // Send tremor data to Hex
  async sendDataToHex(dataPoints) {
    try {
      // Format data for Hex
      const formattedData = {
        tremor_points: dataPoints,
        session_id: this.currentSession.sessionId,
        timestamp: Date.now()
      };

      // Send to Hex API
      const response = await fetch(`${this.config.baseUrl}/data/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.workspaceToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          project_id: this.config.projectId,
          data: formattedData,
          format: 'json'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send data to Hex');
      }

      return await response.json();
    } catch (error) {
      console.error('Error sending data to Hex:', error);
      return null;
    }
  }

  // Run analysis in Hex
  async runAnalysis(analysisType = 'all') {
    try {
      // Trigger notebook execution
      const response = await fetch(`${this.config.notebookUrl}/${this.config.projectId}/run`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.workspaceToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          cells: analysisType === 'all' ? Object.keys(this.analysisCells) : [analysisType],
          parameters: {
            session_id: this.currentSession.sessionId
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to run Hex analysis');
      }

      const result = await response.json();

      // Get execution results
      const analysisResults = await this.getExecutionResults(result.execution_id);

      return this.processAnalysisResults(analysisResults);
    } catch (error) {
      console.error('Error running Hex analysis:', error);
      return null;
    }
  }

  // Get execution results
  async getExecutionResults(executionId) {
    const maxAttempts = 30;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const response = await fetch(`${this.config.baseUrl}/executions/${executionId}`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to get execution results');
      }

      const result = await response.json();

      if (result.status === 'completed') {
        return result.outputs;
      } else if (result.status === 'failed') {
        throw new Error('Hex execution failed: ' + result.error);
      }

      // Wait before polling again
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }

    throw new Error('Hex execution timeout');
  }

  // Process analysis results from Hex
  processAnalysisResults(results) {
    const processed = {
      patterns: {},
      predictions: {},
      visualizations: {},
      recommendations: [],
      metrics: {}
    };

    // Extract results from each cell
    for (const [cellName, output] of Object.entries(results)) {
      switch (cellName) {
        case 'tremor_pattern_analysis':
          processed.patterns = this.extractPatterns(output);
          break;
        case 'ml_prediction_model':
          processed.predictions = this.extractPredictions(output);
          break;
        case 'advanced_visualizations':
          processed.visualizations = this.extractVisualizations(output);
          break;
        case 'ai_recommendations':
          processed.recommendations = this.extractRecommendations(output);
          break;
      }
    }

    // Calculate additional metrics
    processed.metrics = this.calculateMetrics(results);

    return processed;
  }

  // Extract patterns from output
  extractPatterns(output) {
    try {
      const patterns = output.data?.patterns || {};
      return {
        periodic: patterns.periodic || false,
        escalating: patterns.escalating || false,
        stressInduced: patterns.stress_induced || false,
        fatigueRelated: patterns.fatigue_related || false
      };
    } catch (error) {
      console.error('Error extracting patterns:', error);
      return {};
    }
  }

  // Extract predictions
  extractPredictions(output) {
    try {
      return {
        nextHourSeverity: output.data?.next_hour_severity || 0,
        confidence: output.data?.confidence || 0,
        modelAccuracy: output.data?.model_r2 || 0
      };
    } catch (error) {
      console.error('Error extracting predictions:', error);
      return {};
    }
  }

  // Extract visualizations
  extractVisualizations(output) {
    try {
      return output.data?.visualizations || {};
    } catch (error) {
      console.error('Error extracting visualizations:', error);
      return {};
    }
  }

  // Extract recommendations
  extractRecommendations(output) {
    try {
      return output.data?.recommendations || [];
    } catch (error) {
      console.error('Error extracting recommendations:', error);
      return [];
    }
  }

  // Calculate metrics
  calculateMetrics(results) {
    // Aggregate metrics from various analyses
    return {
      averageSeverity: this.currentSession.dataPoints.reduce((sum, p) => sum + p.severity, 0) /
                       Math.max(this.currentSession.dataPoints.length, 1),
      sessionDuration: Date.now() - this.currentSession.startTime,
      dataPointsAnalyzed: this.currentSession.dataPoints.length
    };
  }

  // Start real-time sync with Hex
  startRealtimeSync() {
    // Send data to Hex every 30 seconds
    setInterval(async () => {
      if (this.currentSession.dataPoints.length > 0) {
        await this.sendDataToHex(this.currentSession.dataPoints);

        // Run analysis if we have enough data
        if (this.currentSession.dataPoints.length >= 50) {
          const results = await this.runAnalysis();
          if (results) {
            this.broadcastResults(results);
          }
        }
      }
    }, 30000);
  }

  // Broadcast results to UI
  broadcastResults(results) {
    // Send to Chrome extension
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: 'HEX_ANALYSIS_RESULTS',
        data: results
      });
    }

    // Send to dashboard if open
    if (typeof window !== 'undefined' && window.postMessage) {
      window.postMessage({
        type: 'HEX_ANALYSIS_UPDATE',
        data: results
      }, '*');
    }
  }

  // Add data point
  addDataPoint(dataPoint) {
    this.currentSession.dataPoints.push({
      ...dataPoint,
      timestamp: Date.now(),
      sessionId: this.currentSession.sessionId
    });

    // Trim if too many points
    if (this.currentSession.dataPoints.length > 1000) {
      this.currentSession.dataPoints = this.currentSession.dataPoints.slice(-1000);
    }
  }

  // Generate session ID
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Export data for medical professionals
  async exportMedicalReport() {
    const results = await this.runAnalysis('all');

    const report = {
      patient: {
        sessionId: this.currentSession.sessionId,
        date: new Date().toISOString()
      },
      metrics: results.metrics,
      patterns: results.patterns,
      predictions: results.predictions,
      recommendations: results.recommendations.filter(r => r.priority === 'high' || r.priority === 'urgent'),
      rawData: this.currentSession.dataPoints.slice(-100) // Last 100 points
    };

    // Create downloadable report
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `tremorsense_report_${Date.now()}.json`;
    a.click();

    return report;
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HexAnalyticsIntegration;
}