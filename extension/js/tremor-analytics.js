// TremorSense Analytics Engine with Agentic AI
// This module collects, analyzes, and provides intelligent insights on tremor patterns

class TremorAnalyticsEngine {
  constructor() {
    this.dataPoints = [];
    this.sessionStartTime = Date.now();
    this.missClickHeatmap = new Map();
    this.elementDifficulty = new Map();
    this.aiAgent = new TremorAIAgent();

    // Analytics configuration
    this.config = {
      sampleRate: 100, // ms between samples
      bufferSize: 1000, // max data points in memory
      analysisInterval: 5000, // ms between AI analysis
      heatmapResolution: 50 // pixel grid size
    };

    // Real-time metrics
    this.metrics = {
      currentSeverity: 0,
      avgSeverity: 0,
      peakSeverity: 0,
      tremorsPerMinute: 0,
      clickAccuracy: 100,
      fatigueLevel: 0,
      stressIndicator: 0,
      timeToTarget: [],
      sessionsToday: 0,
      improvementRate: 0
    };

    this.initializeAnalytics();
  }

  initializeAnalytics() {
    // Load historical data
    this.loadHistoricalData();

    // Start real-time collection
    this.startDataCollection();

    // Initialize AI agent
    this.aiAgent.initialize(this.getHistoricalPatterns());

    // Start periodic AI analysis
    setInterval(() => this.runAIAnalysis(), this.config.analysisInterval);
  }

  // Collect tremor data point
  collectDataPoint(data) {
    const dataPoint = {
      timestamp: Date.now(),
      severity: data.severity || 0,
      frequency: data.frequency || 0,
      amplitude: data.amplitude || 0,
      mousePosition: data.position || { x: 0, y: 0 },
      velocity: data.velocity || 0,
      acceleration: data.acceleration || 0,
      targetElement: data.targetElement || null,
      isSuccessfulClick: data.success || false,
      websiteComplexity: this.calculatePageComplexity(),
      timeOfDay: new Date().getHours(),
      sessionDuration: Date.now() - this.sessionStartTime
    };

    // Add to buffer
    this.dataPoints.push(dataPoint);
    if (this.dataPoints.length > this.config.bufferSize) {
      this.dataPoints.shift();
    }

    // Update real-time metrics
    this.updateMetrics(dataPoint);

    // Store for historical analysis
    this.storeDataPoint(dataPoint);

    return dataPoint;
  }

  // Update real-time metrics
  updateMetrics(dataPoint) {
    // Current severity
    this.metrics.currentSeverity = dataPoint.severity;

    // Average severity (rolling window)
    const recentPoints = this.dataPoints.slice(-100);
    this.metrics.avgSeverity = recentPoints.reduce((sum, p) => sum + p.severity, 0) / recentPoints.length;

    // Peak severity
    this.metrics.peakSeverity = Math.max(this.metrics.peakSeverity, dataPoint.severity);

    // Tremors per minute
    const oneMinuteAgo = Date.now() - 60000;
    const recentTremors = this.dataPoints.filter(p => p.timestamp > oneMinuteAgo && p.severity > 0.3);
    this.metrics.tremorsPerMinute = recentTremors.length;

    // Click accuracy
    const recentClicks = this.dataPoints.filter(p => p.targetElement !== null).slice(-20);
    if (recentClicks.length > 0) {
      const successful = recentClicks.filter(p => p.isSuccessfulClick).length;
      this.metrics.clickAccuracy = (successful / recentClicks.length) * 100;
    }

    // Fatigue detection (severity increases over time)
    this.metrics.fatigueLevel = this.calculateFatigueLevel();

    // Stress indicator (based on tremor variance)
    this.metrics.stressIndicator = this.calculateStressLevel();
  }

  // Calculate page complexity score
  calculatePageComplexity() {
    const elements = document.querySelectorAll('button, a, input, select, [role="button"]');
    const avgSize = Array.from(elements).reduce((sum, el) => {
      const rect = el.getBoundingClientRect();
      return sum + (rect.width * rect.height);
    }, 0) / Math.max(elements.length, 1);

    return {
      elementCount: elements.length,
      avgElementSize: avgSize,
      density: elements.length / (window.innerWidth * window.innerHeight),
      complexityScore: Math.min(10, elements.length / 20)
    };
  }

  // Calculate fatigue level
  calculateFatigueLevel() {
    const sessionMinutes = (Date.now() - this.sessionStartTime) / 60000;
    if (sessionMinutes < 5) return 0;

    // Compare early session to current
    const earlyPoints = this.dataPoints.filter(p => p.sessionDuration < 300000); // First 5 min
    const recentPoints = this.dataPoints.slice(-50);

    if (earlyPoints.length === 0 || recentPoints.length === 0) return 0;

    const earlyAvg = earlyPoints.reduce((sum, p) => sum + p.severity, 0) / earlyPoints.length;
    const recentAvg = recentPoints.reduce((sum, p) => sum + p.severity, 0) / recentPoints.length;

    // Fatigue = increase in severity over time
    return Math.min(10, Math.max(0, ((recentAvg - earlyAvg) / earlyAvg) * 10));
  }

  // Calculate stress level
  calculateStressLevel() {
    const recentPoints = this.dataPoints.slice(-30);
    if (recentPoints.length < 10) return 0;

    // Calculate variance in tremor severity
    const severities = recentPoints.map(p => p.severity);
    const mean = severities.reduce((sum, s) => sum + s, 0) / severities.length;
    const variance = severities.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / severities.length;

    // Higher variance = higher stress
    return Math.min(10, variance * 5);
  }

  // Run AI analysis
  async runAIAnalysis() {
    const analysis = await this.aiAgent.analyzePatterns(this.dataPoints);

    // Update predictions and recommendations
    if (analysis.predictions) {
      this.metrics.predictedNextHourSeverity = analysis.predictions.nextHourSeverity;
      this.metrics.optimalBreakTime = analysis.predictions.optimalBreakTime;
    }

    if (analysis.insights) {
      this.broadcastInsights(analysis.insights);
    }

    return analysis;
  }

  // Store data for persistence
  async storeDataPoint(dataPoint) {
    const stored = await chrome.storage.local.get(['analyticsData']);
    const data = stored.analyticsData || { points: [], sessions: [] };

    // Add to current session
    data.points.push(dataPoint);

    // Limit storage size
    if (data.points.length > 10000) {
      data.points = data.points.slice(-10000);
    }

    await chrome.storage.local.set({ analyticsData: data });
  }

  // Load historical data
  async loadHistoricalData() {
    const stored = await chrome.storage.local.get(['analyticsData']);
    if (stored.analyticsData) {
      // Load last session's data for comparison
      this.historicalData = stored.analyticsData;
      this.calculateImprovementRate();
    }
  }

  // Calculate improvement rate
  calculateImprovementRate() {
    if (!this.historicalData || this.historicalData.points.length < 100) return;

    // Compare last week to this week
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const lastWeekData = this.historicalData.points.filter(p => p.timestamp < oneWeekAgo);
    const thisWeekData = this.historicalData.points.filter(p => p.timestamp >= oneWeekAgo);

    if (lastWeekData.length > 0 && thisWeekData.length > 0) {
      const lastWeekAvg = lastWeekData.reduce((sum, p) => sum + p.severity, 0) / lastWeekData.length;
      const thisWeekAvg = thisWeekData.reduce((sum, p) => sum + p.severity, 0) / thisWeekData.length;

      // Improvement = reduction in average severity
      this.metrics.improvementRate = ((lastWeekAvg - thisWeekAvg) / lastWeekAvg) * 100;
    }
  }

  // Get historical patterns
  getHistoricalPatterns() {
    if (!this.historicalData) return null;

    // Group by hour of day
    const hourlyPatterns = new Array(24).fill(null).map(() => []);
    this.historicalData.points.forEach(point => {
      const hour = new Date(point.timestamp).getHours();
      hourlyPatterns[hour].push(point.severity);
    });

    // Calculate average severity by hour
    const patternsByHour = hourlyPatterns.map(hours => {
      if (hours.length === 0) return 0;
      return hours.reduce((sum, s) => sum + s, 0) / hours.length;
    });

    return {
      hourlyPatterns: patternsByHour,
      totalDataPoints: this.historicalData.points.length,
      averageSeverity: this.metrics.avgSeverity
    };
  }

  // Broadcast insights to UI
  broadcastInsights(insights) {
    // Send to popup or dashboard
    chrome.runtime.sendMessage({
      type: 'ANALYTICS_INSIGHTS',
      insights: insights
    });

    // Show notifications for important insights
    if (insights.urgent) {
      this.showInsightNotification(insights.urgent);
    }
  }

  // Show insight notification
  showInsightNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'tremor-insight-notification';
    notification.innerHTML = `
      <div class="insight-icon">💡</div>
      <div class="insight-message">${message}</div>
    `;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #8B2635 0%, #A8312F 100%);
      color: white;
      padding: 15px 20px;
      border-radius: 10px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      z-index: 2147483647;
      display: flex;
      align-items: center;
      gap: 10px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 5000);
  }

  // Generate analytics report
  generateReport() {
    return {
      metrics: this.metrics,
      patterns: this.getHistoricalPatterns(),
      heatmap: this.generateHeatmapData(),
      recommendations: this.aiAgent.getRecommendations(),
      sessionStats: {
        duration: Date.now() - this.sessionStartTime,
        dataPointsCollected: this.dataPoints.length,
        avgSeverity: this.metrics.avgSeverity,
        peakSeverity: this.metrics.peakSeverity,
        clickAccuracy: this.metrics.clickAccuracy
      }
    };
  }

  // Generate heatmap data
  generateHeatmapData() {
    const grid = {};
    const resolution = this.config.heatmapResolution;

    this.missClickHeatmap.forEach((count, key) => {
      const [x, y] = key.split(',').map(Number);
      const gridX = Math.floor(x / resolution) * resolution;
      const gridY = Math.floor(y / resolution) * resolution;
      const gridKey = `${gridX},${gridY}`;
      grid[gridKey] = (grid[gridKey] || 0) + count;
    });

    return grid;
  }

  // Start data collection
  startDataCollection() {
    setInterval(() => {
      // This will be called from content.js with actual tremor data
      // For now, we set up the collection infrastructure
    }, this.config.sampleRate);
  }
}

// AI Agent for intelligent tremor analysis
class TremorAIAgent {
  constructor() {
    this.model = null;
    this.patterns = [];
    this.recommendations = [];
  }

  initialize(historicalPatterns) {
    this.patterns = historicalPatterns;
    this.trainModel();
  }

  // Simplified ML model for pattern recognition
  trainModel() {
    // In a real implementation, this would use TensorFlow.js or similar
    // For now, we use rule-based intelligence
    this.model = {
      fatigueThreshold: 5,
      stressThreshold: 6,
      optimalBreakInterval: 30, // minutes
      severityPredictionWeight: 0.7
    };
  }

  // Analyze patterns with AI
  async analyzePatterns(dataPoints) {
    const recentData = dataPoints.slice(-100);
    const insights = [];
    const predictions = {};

    // Fatigue detection
    const fatigueLevel = this.detectFatigue(recentData);
    if (fatigueLevel > this.model.fatigueThreshold) {
      insights.push({
        type: 'fatigue',
        message: `High fatigue detected. Consider taking a ${Math.round(fatigueLevel * 2)}-minute break.`,
        urgent: fatigueLevel > 7
      });
      predictions.optimalBreakTime = new Date(Date.now() + 5 * 60000).toLocaleTimeString();
    }

    // Pattern recognition
    const pattern = this.recognizePattern(recentData);
    if (pattern) {
      insights.push({
        type: 'pattern',
        message: `Tremor pattern detected: ${pattern.type}. ${pattern.suggestion}`,
        urgent: false
      });
    }

    // Prediction
    predictions.nextHourSeverity = this.predictNextHourSeverity(recentData);

    // Website-specific recommendations
    const siteRecommendation = this.analyzeSiteInteraction(recentData);
    if (siteRecommendation) {
      insights.push(siteRecommendation);
    }

    // Update recommendations
    this.updateRecommendations(insights);

    return {
      insights: insights.length > 0 ? insights[0] : null,
      predictions: predictions,
      confidence: this.calculateConfidence(recentData)
    };
  }

  // Detect fatigue patterns
  detectFatigue(dataPoints) {
    if (dataPoints.length < 20) return 0;

    // Compare first quarter to last quarter
    const quarter = Math.floor(dataPoints.length / 4);
    const firstQuarter = dataPoints.slice(0, quarter);
    const lastQuarter = dataPoints.slice(-quarter);

    const firstAvg = firstQuarter.reduce((sum, p) => sum + p.severity, 0) / firstQuarter.length;
    const lastAvg = lastQuarter.reduce((sum, p) => sum + p.severity, 0) / lastQuarter.length;

    const increase = ((lastAvg - firstAvg) / firstAvg) * 10;
    return Math.max(0, Math.min(10, increase));
  }

  // Recognize tremor patterns
  recognizePattern(dataPoints) {
    const severities = dataPoints.map(p => p.severity);

    // Check for periodic pattern
    const isPeriodic = this.detectPeriodicity(severities);
    if (isPeriodic) {
      return {
        type: 'Periodic tremor',
        suggestion: 'Your tremors show a regular pattern. Try timing activities between peaks.'
      };
    }

    // Check for escalating pattern
    const isEscalating = this.detectEscalation(severities);
    if (isEscalating) {
      return {
        type: 'Escalating tremor',
        suggestion: 'Tremor severity is increasing. Consider a break or relaxation exercise.'
      };
    }

    // Check for stress-induced spikes
    const hasSpikes = this.detectSpikes(severities);
    if (hasSpikes) {
      return {
        type: 'Stress spikes',
        suggestion: 'Sudden tremor spikes detected. Try deep breathing exercises.'
      };
    }

    return null;
  }

  // Detect periodicity in data
  detectPeriodicity(data) {
    if (data.length < 30) return false;

    // Simple autocorrelation check
    let correlation = 0;
    const lag = Math.floor(data.length / 4);

    for (let i = 0; i < data.length - lag; i++) {
      correlation += data[i] * data[i + lag];
    }

    correlation /= (data.length - lag);
    return correlation > 0.5;
  }

  // Detect escalation pattern
  detectEscalation(data) {
    if (data.length < 10) return false;

    let increasing = 0;
    for (let i = 1; i < data.length; i++) {
      if (data[i] > data[i - 1]) increasing++;
    }

    return (increasing / data.length) > 0.7;
  }

  // Detect sudden spikes
  detectSpikes(data) {
    if (data.length < 10) return false;

    const mean = data.reduce((sum, d) => sum + d, 0) / data.length;
    const stdDev = Math.sqrt(data.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / data.length);

    const spikes = data.filter(d => d > mean + 2 * stdDev);
    return spikes.length > data.length * 0.1;
  }

  // Predict next hour severity
  predictNextHourSeverity(dataPoints) {
    if (dataPoints.length < 30) return null;

    // Simple moving average prediction
    const recentAvg = dataPoints.slice(-10).reduce((sum, p) => sum + p.severity, 0) / 10;
    const trend = this.detectEscalation(dataPoints.map(p => p.severity)) ? 1.2 : 1.0;

    return Math.min(10, recentAvg * trend);
  }

  // Analyze site-specific interaction
  analyzeSiteInteraction(dataPoints) {
    const clickPoints = dataPoints.filter(p => p.targetElement);
    if (clickPoints.length < 5) return null;

    const missedClicks = clickPoints.filter(p => !p.isSuccessfulClick);
    const missRate = missedClicks.length / clickPoints.length;

    if (missRate > 0.3) {
      return {
        type: 'interaction',
        message: `High miss-click rate (${Math.round(missRate * 100)}%). Enabling larger targets.`,
        urgent: missRate > 0.5
      };
    }

    return null;
  }

  // Calculate confidence in predictions
  calculateConfidence(dataPoints) {
    // More data = higher confidence
    const dataConfidence = Math.min(1, dataPoints.length / 100);

    // Less variance = higher confidence
    const severities = dataPoints.map(p => p.severity);
    const mean = severities.reduce((sum, s) => sum + s, 0) / severities.length;
    const variance = severities.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / severities.length;
    const varianceConfidence = Math.max(0, 1 - variance);

    return (dataConfidence + varianceConfidence) / 2;
  }

  // Update recommendations
  updateRecommendations(insights) {
    this.recommendations = insights.map(insight => ({
      text: insight.message,
      priority: insight.urgent ? 'high' : 'normal',
      timestamp: Date.now()
    }));
  }

  // Get current recommendations
  getRecommendations() {
    return this.recommendations.slice(0, 5);
  }
}

// Export for use in content.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TremorAnalyticsEngine, TremorAIAgent };
}