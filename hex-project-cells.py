# TremorSense Analytics - Hex Project Cells
# Copy each cell into your Hex project in order

# ============================================
# Cell 1: Setup and Imports
# ============================================
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import json
import warnings
warnings.filterwarnings('ignore')

# Initialize data storage
if 'tremor_data' not in globals():
    tremor_data = pd.DataFrame()
    session_data = {}
    analysis_results = {}

print("✅ TremorSense Analytics initialized")
print(f"📊 Ready to analyze tremor patterns")

# ============================================
# Cell 2: Data Ingestion API
# ============================================
# Note: datetime already imported in Cell 1

def ingest_tremor_data(data_points):
    """
    Ingest tremor data from the Chrome extension
    """
    global tremor_data

    # Convert to DataFrame
    new_data = pd.DataFrame(data_points)

    if not new_data.empty:
        # Add timestamp if not present
        if 'timestamp' not in new_data.columns:
            new_data['timestamp'] = pd.to_datetime('now')
        else:
            new_data['timestamp'] = pd.to_datetime(new_data['timestamp'], unit='ms')

        # Append to existing data
        tremor_data = pd.concat([tremor_data, new_data], ignore_index=True)

        # Keep only last 24 hours of data
        cutoff = datetime.now() - timedelta(hours=24)
        tremor_data = tremor_data[tremor_data['timestamp'] > cutoff]

        print(f"📥 Ingested {len(new_data)} new data points")
        print(f"📈 Total data points: {len(tremor_data)}")

    return len(tremor_data)

# Simulate data ingestion for testing
def generate_sample_data(n_points=100):
    """Generate sample tremor data for testing"""

    time_range = pd.date_range(end=datetime.now(), periods=n_points, freq='100ms')

    # Generate realistic tremor patterns
    base_severity = 3 + np.sin(np.linspace(0, 4*np.pi, n_points)) * 2
    noise = np.random.normal(0, 0.5, n_points)
    severity = np.clip(base_severity + noise, 0, 10)

    sample_data = pd.DataFrame({
        'timestamp': time_range,
        'severity': severity,
        'frequency': np.random.randint(5, 20, n_points),
        'amplitude': severity * 10 + np.random.normal(0, 5, n_points),
        'velocity': np.random.uniform(10, 100, n_points),
        'acceleration': np.random.uniform(-50, 50, n_points),
        'position_x': np.cumsum(np.random.randn(n_points)) * 10,
        'position_y': np.cumsum(np.random.randn(n_points)) * 10,
        'isSuccessfulClick': np.random.choice([True, False], n_points, p=[0.8, 0.2]),
        'sessionDuration': np.linspace(0, 3600, n_points)
    })

    return sample_data

# Generate initial sample data
if tremor_data.empty:
    tremor_data = generate_sample_data(500)
    print("🎲 Generated sample data for demonstration")

# Display last few rows (use display() if available in Hex, otherwise print)
print(tremor_data.tail())

# ============================================
# Cell 3: Pattern Detection & Analysis
# ============================================
def analyze_tremor_patterns(data):
    """
    Detect various tremor patterns using signal processing
    """
    if len(data) < 30:
        return {"error": "Insufficient data for pattern analysis"}

    patterns = {
        'periodic': False,
        'escalating': False,
        'stress_induced': False,
        'fatigue_related': False,
        'details': {}
    }

    severity = data['severity'].values

    # 1. Periodic Pattern Detection using FFT
    if len(severity) > 100:
        # Apply FFT using numpy
        yf = np.fft.fft(severity)
        xf = np.fft.fftfreq(len(severity), 0.1)[:len(severity)//2]  # 0.1s sampling

        # Find dominant frequency
        power = 2.0/len(severity) * np.abs(yf[0:len(severity)//2])
        dominant_freq_idx = np.argmax(power[1:]) + 1  # Skip DC component
        dominant_freq = xf[dominant_freq_idx]

        # If there's a clear dominant frequency, it's periodic
        if power[dominant_freq_idx] > np.mean(power) * 2:
            patterns['periodic'] = True
            patterns['details']['period'] = 1/dominant_freq if dominant_freq > 0 else None
            patterns['details']['frequency'] = dominant_freq

    # 2. Escalating Pattern (severity increases over time)
    time_windows = np.array_split(severity, 5)
    window_means = [np.mean(w) for w in time_windows]

    if all(window_means[i] <= window_means[i+1] for i in range(len(window_means)-1)):
        patterns['escalating'] = True
        patterns['details']['severity_increase'] = window_means[-1] - window_means[0]

    # 3. Stress-Induced Spikes
    mean_severity = np.mean(severity)
    std_severity = np.std(severity)
    spikes = severity > (mean_severity + 2 * std_severity)
    spike_ratio = np.sum(spikes) / len(severity)

    if spike_ratio > 0.05:  # More than 5% are spikes
        patterns['stress_induced'] = True
        patterns['details']['spike_frequency'] = spike_ratio
        patterns['details']['max_spike'] = np.max(severity)

    # 4. Fatigue Pattern (comparing early vs late session)
    if 'sessionDuration' in data.columns:
        early_data = data[data['sessionDuration'] < data['sessionDuration'].median()]
        late_data = data[data['sessionDuration'] >= data['sessionDuration'].median()]

        if len(early_data) > 10 and len(late_data) > 10:
            early_severity = early_data['severity'].mean()
            late_severity = late_data['severity'].mean()

            if late_severity > early_severity * 1.2:  # 20% increase
                patterns['fatigue_related'] = True
                patterns['details']['fatigue_increase'] = (late_severity - early_severity) / early_severity * 100

    return patterns

# Run pattern analysis
patterns = analyze_tremor_patterns(tremor_data)
analysis_results['patterns'] = patterns

print("🔍 Pattern Analysis Results:")
for pattern, detected in patterns.items():
    if pattern != 'details' and detected:
        print(f"  ✓ {pattern.replace('_', ' ').title()}: Detected")
        if pattern in patterns['details']:
            for key, value in patterns['details'].items():
                if pattern in key:
                    print(f"    - {key}: {value:.2f}" if isinstance(value, float) else f"    - {key}: {value}")

# ============================================
# Cell 4: Machine Learning Predictions
# ============================================
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_squared_error, r2_score

def create_features(df):
    """Create features for ML model"""
    features = pd.DataFrame()

    # Time-based features
    features['hour'] = df['timestamp'].dt.hour
    features['minute'] = df['timestamp'].dt.minute
    features['day_of_week'] = df['timestamp'].dt.dayofweek

    # Rolling statistics
    for window in [5, 10, 20]:
        features[f'severity_ma_{window}'] = df['severity'].rolling(window, min_periods=1).mean()
        features[f'severity_std_{window}'] = df['severity'].rolling(window, min_periods=1).std()

    # Lag features
    for lag in [1, 5, 10]:
        features[f'severity_lag_{lag}'] = df['severity'].shift(lag)

    # Physical metrics
    if 'velocity' in df.columns:
        features['velocity'] = df['velocity']
        features['velocity_ma'] = df['velocity'].rolling(5, min_periods=1).mean()

    if 'acceleration' in df.columns:
        features['acceleration'] = df['acceleration']

    if 'frequency' in df.columns:
        features['frequency'] = df['frequency']

    # Session features
    if 'sessionDuration' in df.columns:
        features['session_minutes'] = df['sessionDuration'] / 60

    return features.fillna(0)

def train_prediction_model(data):
    """Train ML model to predict tremor severity"""

    if len(data) < 100:
        return None, {"error": "Insufficient data for training"}

    # Prepare features and target
    X = create_features(data)
    y = data['severity']

    # Remove any remaining NaN values
    valid_idx = ~(X.isna().any(axis=1) | y.isna())
    X = X[valid_idx]
    y = y[valid_idx]

    if len(X) < 50:
        return None, {"error": "Insufficient valid data"}

    # Split data
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # Scale features
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # Train ensemble model
    rf_model = RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42)
    gb_model = GradientBoostingRegressor(n_estimators=100, max_depth=5, random_state=42)

    rf_model.fit(X_train_scaled, y_train)
    gb_model.fit(X_train_scaled, y_train)

    # Ensemble predictions (average of both models)
    rf_pred = rf_model.predict(X_test_scaled)
    gb_pred = gb_model.predict(X_test_scaled)
    y_pred = (rf_pred + gb_pred) / 2

    # Calculate metrics
    mse = mean_squared_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)

    # Feature importance (from Random Forest)
    feature_importance = pd.DataFrame({
        'feature': X.columns,
        'importance': rf_model.feature_importances_
    }).sort_values('importance', ascending=False).head(10)

    # Make predictions for next hour
    last_features = create_features(data.tail(20))
    if len(last_features) > 0:
        last_scaled = scaler.transform(last_features.tail(1))
        next_hour_rf = rf_model.predict(last_scaled)[0]
        next_hour_gb = gb_model.predict(last_scaled)[0]
        next_hour_prediction = (next_hour_rf + next_hour_gb) / 2
        confidence = min(0.95, r2 + 0.1)
    else:
        next_hour_prediction = data['severity'].mean()
        confidence = 0.5

    results = {
        'mse': mse,
        'r2_score': r2,
        'next_hour_severity': next_hour_prediction,
        'confidence': confidence,
        'feature_importance': feature_importance.to_dict('records'),
        'model': (rf_model, gb_model, scaler)
    }

    return (rf_model, gb_model, scaler), results

# Train the model
model, ml_results = train_prediction_model(tremor_data)
analysis_results['ml_predictions'] = ml_results

print("\n🤖 Machine Learning Results:")
print(f"  Model R² Score: {ml_results['r2_score']:.3f}")
print(f"  MSE: {ml_results['mse']:.3f}")
print(f"\n📮 Predictions:")
print(f"  Next Hour Severity: {ml_results['next_hour_severity']:.2f}/10")
print(f"  Confidence: {ml_results['confidence']*100:.1f}%")
print(f"\n🎯 Top Features:")
for feat in ml_results['feature_importance'][:5]:
    print(f"  - {feat['feature']}: {feat['importance']:.3f}")

# ============================================
# Cell 5: Advanced Visualizations
# ============================================
# 1. Tremor Severity Over Time with Predictions
fig_timeline = go.Figure()

# Actual severity
fig_timeline.add_trace(go.Scatter(
    x=tremor_data['timestamp'],
    y=tremor_data['severity'],
    mode='lines',
    name='Actual Severity',
    line=dict(color='#8B2635', width=2),
    hovertemplate='Time: %{x}<br>Severity: %{y:.2f}<extra></extra>'
))

# Moving average
ma_window = 20
tremor_data['severity_ma'] = tremor_data['severity'].rolling(ma_window, min_periods=1).mean()
fig_timeline.add_trace(go.Scatter(
    x=tremor_data['timestamp'],
    y=tremor_data['severity_ma'],
    mode='lines',
    name=f'{ma_window}-Point Moving Avg',
    line=dict(color='#A8312F', width=2, dash='dash'),
    hovertemplate='Time: %{x}<br>Avg: %{y:.2f}<extra></extra>'
))

# Add prediction for next hour
future_time = tremor_data['timestamp'].iloc[-1] + timedelta(hours=1)
fig_timeline.add_trace(go.Scatter(
    x=[tremor_data['timestamp'].iloc[-1], future_time],
    y=[tremor_data['severity'].iloc[-1], ml_results['next_hour_severity']],
    mode='lines+markers',
    name='Prediction',
    line=dict(color='#4A90A4', width=2, dash='dot'),
    marker=dict(size=10),
    hovertemplate='Predicted: %{y:.2f}<extra></extra>'
))

fig_timeline.update_layout(
    title='Tremor Severity Timeline with ML Prediction',
    xaxis_title='Time',
    yaxis_title='Severity (0-10)',
    height=400,
    hovermode='x unified'
)

fig_timeline.show()

# 2. Tremor Pattern Heatmap (Hourly Average)
hourly_data = tremor_data.copy()
hourly_data['hour'] = hourly_data['timestamp'].dt.hour
hourly_data['date'] = hourly_data['timestamp'].dt.date

heatmap_data = hourly_data.groupby(['date', 'hour'])['severity'].mean().unstack(fill_value=0)

fig_heatmap = go.Figure(data=go.Heatmap(
    z=heatmap_data.values,
    x=list(range(24)),
    y=[str(d) for d in heatmap_data.index],
    colorscale='RdBu_r',
    colorbar_title='Severity',
    hovertemplate='Date: %{y}<br>Hour: %{x}:00<br>Avg Severity: %{z:.2f}<extra></extra>'
))

fig_heatmap.update_layout(
    title='Tremor Severity Heatmap by Hour',
    xaxis_title='Hour of Day',
    yaxis_title='Date',
    height=350
)

fig_heatmap.show()

# 3. Click Accuracy Analysis
if 'isSuccessfulClick' in tremor_data.columns:
    # Group by severity bins
    tremor_data['severity_bin'] = pd.cut(tremor_data['severity'],
                                         bins=[0, 2, 4, 6, 8, 10],
                                         labels=['Very Low', 'Low', 'Medium', 'High', 'Very High'])

    accuracy_by_severity = tremor_data.groupby('severity_bin')['isSuccessfulClick'].agg(['mean', 'count'])
    accuracy_by_severity['accuracy_pct'] = accuracy_by_severity['mean'] * 100

    fig_accuracy = go.Figure(data=[
        go.Bar(
            x=accuracy_by_severity.index,
            y=accuracy_by_severity['accuracy_pct'],
            text=[f"{acc:.1f}%" for acc in accuracy_by_severity['accuracy_pct']],
            textposition='auto',
            marker_color=['#4ade80', '#67B8CC', '#FFB84D', '#FF6B6B', '#8B2635']
        )
    ])

    fig_accuracy.update_layout(
        title='Click Accuracy by Tremor Severity',
        xaxis_title='Tremor Severity',
        yaxis_title='Click Accuracy (%)',
        height=350,
        showlegend=False
    )

    fig_accuracy.show()

# 4. Real-time Metrics Dashboard
fig_metrics = make_subplots(
    rows=2, cols=2,
    subplot_titles=('Severity Distribution', 'Velocity vs Severity',
                   'Session Fatigue Progression', 'Frequency Spectrum'),
    specs=[[{'type': 'histogram'}, {'type': 'scatter'}],
           [{'type': 'scatter'}, {'type': 'bar'}]]
)

# Severity distribution
fig_metrics.add_trace(
    go.Histogram(x=tremor_data['severity'], nbinsx=20, marker_color='#8B2635'),
    row=1, col=1
)

# Velocity vs Severity scatter
if 'velocity' in tremor_data.columns:
    fig_metrics.add_trace(
        go.Scatter(x=tremor_data['velocity'], y=tremor_data['severity'],
                  mode='markers', marker=dict(color='#4A90A4', size=5, opacity=0.5)),
        row=1, col=2
    )

# Fatigue progression
if 'sessionDuration' in tremor_data.columns:
    session_bins = pd.cut(tremor_data['sessionDuration'], bins=10)
    fatigue_prog = tremor_data.groupby(session_bins)['severity'].mean()

    fig_metrics.add_trace(
        go.Scatter(x=list(range(len(fatigue_prog))), y=fatigue_prog.values,
                  mode='lines+markers', line=dict(color='#A8312F', width=3)),
        row=2, col=1
    )

# Frequency spectrum
if 'frequency' in tremor_data.columns:
    freq_counts = tremor_data['frequency'].value_counts().sort_index()
    fig_metrics.add_trace(
        go.Bar(x=freq_counts.index, y=freq_counts.values, marker_color='#67B8CC'),
        row=2, col=2
    )

fig_metrics.update_layout(height=600, showlegend=False)
fig_metrics.show()

print("\n📊 Visualizations generated successfully!")

# ============================================
# Cell 6: AI-Powered Recommendations
# ============================================
def generate_ai_recommendations(patterns, ml_results, data_stats):
    """
    Generate intelligent recommendations based on analysis
    """
    recommendations = []
    priority_map = {'urgent': 1, 'high': 2, 'medium': 3, 'low': 4}

    # Pattern-based recommendations
    if patterns['fatigue_related']:
        severity_increase = patterns['details'].get('fatigue_increase', 0)
        recommendations.append({
            'type': 'break',
            'priority': 'urgent' if severity_increase > 50 else 'high',
            'title': 'Fatigue Detected',
            'message': f'Tremor severity increased by {severity_increase:.1f}%. Take a 15-minute break.',
            'action': 'schedule_break',
            'icon': '😴'
        })

    if patterns['periodic']:
        period = patterns['details'].get('period', 0)
        if period > 0:
            recommendations.append({
                'type': 'timing',
                'priority': 'medium',
                'title': 'Periodic Pattern',
                'message': f'Tremors peak every {period:.1f} seconds. Time tasks between peaks.',
                'action': 'optimize_timing',
                'icon': '⏰'
            })

    if patterns['stress_induced']:
        spike_freq = patterns['details'].get('spike_frequency', 0) * 100
        recommendations.append({
            'type': 'relaxation',
            'priority': 'high',
            'title': 'Stress Spikes Detected',
            'message': f'{spike_freq:.1f}% of readings show stress spikes. Try breathing exercises.',
            'action': 'start_breathing',
            'icon': '🧘'
        })

    if patterns['escalating']:
        increase = patterns['details'].get('severity_increase', 0)
        recommendations.append({
            'type': 'intervention',
            'priority': 'high' if increase > 3 else 'medium',
            'title': 'Escalating Tremor',
            'message': f'Severity increased by {increase:.1f} points. Consider medication timing.',
            'action': 'check_medication',
            'icon': '💊'
        })

    # ML-based recommendations
    if ml_results['next_hour_severity'] > 7:
        recommendations.append({
            'type': 'prevention',
            'priority': 'urgent',
            'title': 'High Severity Predicted',
            'message': f"Severity of {ml_results['next_hour_severity']:.1f} predicted. Enable maximum assistance.",
            'action': 'enable_max_assistance',
            'icon': '⚠️'
        })
    elif ml_results['next_hour_severity'] < 3:
        recommendations.append({
            'type': 'opportunity',
            'priority': 'low',
            'title': 'Low Tremor Window',
            'message': 'Optimal time for precision tasks in the next hour.',
            'action': 'schedule_tasks',
            'icon': '✨'
        })

    # Click accuracy recommendations
    if 'click_accuracy' in data_stats and data_stats['click_accuracy'] < 70:
        recommendations.append({
            'type': 'ui_adjustment',
            'priority': 'high',
            'title': 'Low Click Accuracy',
            'message': f"Click accuracy at {data_stats['click_accuracy']:.1f}%. Increasing target sizes.",
            'action': 'enlarge_targets',
            'icon': '🎯'
        })

    # Time-based recommendations
    current_hour = datetime.now().hour
    current_severity = data_stats.get('current_severity', 0)

    if current_hour in [14, 15, 16] and current_severity > 5:
        recommendations.append({
            'type': 'timing',
            'priority': 'medium',
            'title': 'Afternoon Tremor Peak',
            'message': 'Common afternoon tremor increase detected. Consider a power nap.',
            'action': 'suggest_nap',
            'icon': '💤'
        })

    # Sort by priority
    recommendations.sort(key=lambda x: priority_map.get(x['priority'], 5))

    return recommendations[:5]  # Return top 5 recommendations

# Calculate current statistics
data_stats = {
    'current_severity': tremor_data['severity'].iloc[-10:].mean(),
    'click_accuracy': tremor_data['isSuccessfulClick'].mean() * 100 if 'isSuccessfulClick' in tremor_data.columns else 85,
    'avg_velocity': tremor_data['velocity'].mean() if 'velocity' in tremor_data.columns else 50,
    'session_duration': tremor_data['sessionDuration'].iloc[-1] if 'sessionDuration' in tremor_data.columns else 1800
}

# Generate recommendations
recommendations = generate_ai_recommendations(patterns, ml_results, data_stats)
analysis_results['recommendations'] = recommendations

print("\n🎯 AI Recommendations:")
for i, rec in enumerate(recommendations, 1):
    print(f"\n{i}. {rec['icon']} {rec['title']} [{rec['priority'].upper()}]")
    print(f"   {rec['message']}")
    print(f"   → Action: {rec['action']}")

# ============================================
# Cell 7: Real-time Statistics & Summary
# ============================================
def calculate_session_stats(data):
    """Calculate comprehensive session statistics"""

    stats = {
        'session_duration': (data['timestamp'].max() - data['timestamp'].min()).total_seconds() / 60,
        'total_data_points': len(data),
        'avg_severity': data['severity'].mean(),
        'std_severity': data['severity'].std(),
        'min_severity': data['severity'].min(),
        'max_severity': data['severity'].max(),
        'current_severity': data['severity'].iloc[-10:].mean(),
        'tremors_per_minute': 0,
        'improvement_rate': 0
    }

    # Calculate tremors per minute (severity > threshold)
    tremor_threshold = 5
    high_tremors = data[data['severity'] > tremor_threshold]
    if stats['session_duration'] > 0:
        stats['tremors_per_minute'] = len(high_tremors) / stats['session_duration']

    # Calculate improvement rate (comparing first and last quartile)
    if len(data) > 40:
        first_quarter = data.iloc[:len(data)//4]['severity'].mean()
        last_quarter = data.iloc[-len(data)//4:]['severity'].mean()
        stats['improvement_rate'] = ((first_quarter - last_quarter) / first_quarter) * 100

    # Click accuracy if available
    if 'isSuccessfulClick' in data.columns:
        stats['click_accuracy'] = data['isSuccessfulClick'].mean() * 100
        stats['total_clicks'] = len(data[data['isSuccessfulClick'].notna()])
        stats['missed_clicks'] = len(data[data['isSuccessfulClick'] == False])

    # Fatigue level (0-10)
    if 'sessionDuration' in data.columns and len(data) > 20:
        early = data.iloc[:10]['severity'].mean()
        recent = data.iloc[-10:]['severity'].mean()
        stats['fatigue_level'] = min(10, max(0, ((recent - early) / early) * 10)) if early > 0 else 0
    else:
        stats['fatigue_level'] = 0

    # Stress indicator (based on variance)
    recent_data = data.iloc[-30:] if len(data) > 30 else data
    stats['stress_indicator'] = min(10, recent_data['severity'].std() * 2)

    return stats

# Calculate session statistics
session_stats = calculate_session_stats(tremor_data)
analysis_results['session_stats'] = session_stats

print("\n📈 Session Statistics:")
print("="*50)
print(f"Duration: {session_stats['session_duration']:.1f} minutes")
print(f"Data Points: {session_stats['total_data_points']}")
print(f"\nSeverity Metrics:")
print(f"  Current: {session_stats['current_severity']:.2f}/10")
print(f"  Average: {session_stats['avg_severity']:.2f}/10")
print(f"  Peak: {session_stats['max_severity']:.2f}/10")
print(f"  Std Dev: {session_stats['std_severity']:.2f}")

if 'click_accuracy' in session_stats:
    print(f"\nInteraction Metrics:")
    print(f"  Click Accuracy: {session_stats['click_accuracy']:.1f}%")
    print(f"  Total Clicks: {session_stats['total_clicks']}")
    print(f"  Missed Clicks: {session_stats['missed_clicks']}")

print(f"\nHealth Indicators:")
print(f"  Fatigue Level: {session_stats['fatigue_level']:.1f}/10")
print(f"  Stress Level: {session_stats['stress_indicator']:.1f}/10")
print(f"  Tremors/Min: {session_stats['tremors_per_minute']:.2f}")

if session_stats['improvement_rate'] != 0:
    symbol = "↓" if session_stats['improvement_rate'] > 0 else "↑"
    print(f"  Improvement: {symbol} {abs(session_stats['improvement_rate']):.1f}%")

# ============================================
# Cell 8: Export Results as JSON API Response
# ============================================
# Compile all results for the extension
api_response = {
    'timestamp': datetime.now().isoformat(),
    'status': 'success',
    'session_id': 'tremor_' + datetime.now().strftime('%Y%m%d_%H%M%S'),
    'analysis': {
        'patterns': {
            'detected': [k for k, v in patterns.items() if v and k != 'details'],
            'details': patterns.get('details', {})
        },
        'predictions': {
            'next_hour_severity': float(ml_results['next_hour_severity']),
            'confidence': float(ml_results['confidence']),
            'model_accuracy': float(ml_results['r2_score'])
        },
        'recommendations': recommendations,
        'statistics': session_stats
    },
    'visualizations': {
        'timeline_chart': fig_timeline.to_json(),
        'heatmap': fig_heatmap.to_json(),
        'metrics_dashboard': fig_metrics.to_json()
    }
}

# Save to variable for API endpoint
analysis_results['api_response'] = api_response

print("\n✅ Analysis Complete!")
print(f"📤 API Response ready with {len(api_response['analysis']['recommendations'])} recommendations")
print(f"📊 {len([k for k,v in patterns.items() if v and k != 'details'])} patterns detected")
print(f"🎯 Prediction confidence: {ml_results['confidence']*100:.1f}%")

# Display formatted JSON (truncated for readability)
import json
response_preview = {k: v for k, v in api_response.items() if k != 'visualizations'}
print("\n📋 API Response Preview:")
print(json.dumps(response_preview, indent=2, default=str)[:1000] + "...")

# ============================================
# Cell 9: Medical Report Generation
# ============================================
def generate_medical_report(data, analysis_results):
    """
    Generate a comprehensive medical report for healthcare providers
    """

    report = {
        'patient_session': {
            'date': datetime.now().strftime('%Y-%m-%d'),
            'time': datetime.now().strftime('%H:%M:%S'),
            'duration_minutes': session_stats['session_duration'],
            'data_points_collected': len(data)
        },
        'tremor_characteristics': {
            'average_severity': f"{session_stats['avg_severity']:.2f}/10",
            'peak_severity': f"{session_stats['max_severity']:.2f}/10",
            'current_severity': f"{session_stats['current_severity']:.2f}/10",
            'variability': f"{session_stats['std_severity']:.2f}",
            'frequency': f"{session_stats['tremors_per_minute']:.2f} tremors/min"
        },
        'pattern_analysis': {
            'periodic_tremor': patterns['periodic'],
            'escalating_pattern': patterns['escalating'],
            'stress_induced': patterns['stress_induced'],
            'fatigue_related': patterns['fatigue_related']
        },
        'functional_impact': {
            'click_accuracy': f"{session_stats.get('click_accuracy', 'N/A')}%",
            'missed_interactions': session_stats.get('missed_clicks', 'N/A'),
            'fatigue_score': f"{session_stats['fatigue_level']:.1f}/10",
            'stress_score': f"{session_stats['stress_indicator']:.1f}/10"
        },
        'ai_insights': {
            'predicted_severity_next_hour': f"{ml_results['next_hour_severity']:.2f}/10",
            'prediction_confidence': f"{ml_results['confidence']*100:.1f}%",
            'primary_recommendation': recommendations[0]['message'] if recommendations else 'No urgent recommendations'
        },
        'clinical_observations': [],
        'raw_data_sample': data.tail(20).to_dict('records')
    }

    # Add clinical observations based on patterns
    if patterns['fatigue_related']:
        report['clinical_observations'].append(
            "Progressive tremor worsening observed during session, suggesting fatigue component"
        )

    if patterns['periodic']:
        period = patterns['details'].get('period', 0)
        report['clinical_observations'].append(
            f"Periodic tremor pattern detected with cycle of {period:.1f} seconds"
        )

    if patterns['stress_induced']:
        report['clinical_observations'].append(
            "Sudden severity spikes detected, possibly stress or stimulus-induced"
        )

    if session_stats['improvement_rate'] > 10:
        report['clinical_observations'].append(
            f"Positive response noted: {session_stats['improvement_rate']:.1f}% improvement during session"
        )

    return report

# Generate medical report
medical_report = generate_medical_report(tremor_data, analysis_results)

print("\n🏥 Medical Report Generated")
print("="*50)
print(f"Date: {medical_report['patient_session']['date']}")
print(f"Duration: {medical_report['patient_session']['duration_minutes']:.1f} minutes")
print(f"\nTremor Characteristics:")
for key, value in medical_report['tremor_characteristics'].items():
    print(f"  {key.replace('_', ' ').title()}: {value}")
print(f"\nClinical Observations:")
for obs in medical_report['clinical_observations']:
    print(f"  • {obs}")

# Save report for export
analysis_results['medical_report'] = medical_report
print(f"\n📄 Report ready for export to healthcare provider")

# ============================================
# Cell 10: Create Hex API Endpoint
# ============================================
# This cell sets up the API endpoint for the Chrome extension
# Note: In Hex, you would publish this as an API endpoint

def process_tremor_data(request_data):
    """
    Main API endpoint for Chrome extension
    Accepts tremor data and returns analysis results
    """

    # Ingest new data
    if 'data_points' in request_data:
        ingest_tremor_data(request_data['data_points'])

    # Run analysis
    patterns = analyze_tremor_patterns(tremor_data)
    model, ml_results = train_prediction_model(tremor_data)

    # Calculate statistics
    stats = calculate_session_stats(tremor_data)

    # Generate recommendations
    recommendations = generate_ai_recommendations(patterns, ml_results, stats)

    # Prepare response
    response = {
        'status': 'success',
        'timestamp': datetime.now().isoformat(),
        'analysis': {
            'patterns': patterns,
            'predictions': {
                'next_hour_severity': ml_results['next_hour_severity'],
                'confidence': ml_results['confidence']
            },
            'recommendations': recommendations,
            'statistics': stats
        }
    }

    return response

# Example API usage
sample_request = {
    'data_points': generate_sample_data(10).to_dict('records')
}

api_result = process_tremor_data(sample_request)
print("\n🌐 API Endpoint Ready!")
print(f"Endpoint: /process_tremor_data")
print(f"Method: POST")
print(f"Sample Response: {json.dumps(api_result, indent=2, default=str)[:500]}...")

print("\n✅ All Hex cells configured successfully!")
print("📌 Next steps:")
print("1. Publish the process_tremor_data function as an API endpoint")
print("2. Configure webhook URL in your Chrome extension")
print("3. Enable real-time data sync")