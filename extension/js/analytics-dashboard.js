// TremorSense Analytics Dashboard JavaScript

let analyticsEngine = null;
let hexAnalytics = null;
let updateInterval = null;

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Analytics Dashboard initializing...');

  // Load Hex configuration (always available with YOUR credentials)
  const stored = await chrome.storage.local.get(['hexConfig']);
  let hexConfig = stored.hexConfig;

  // If not in storage yet, create it with the hardcoded config
  if (!hexConfig) {
    // This will load YOUR credentials from hex-config.js
    const configScript = document.createElement('script');
    configScript.src = chrome.runtime.getURL('js/hex-config.js');
    await new Promise(resolve => {
      configScript.onload = resolve;
      document.head.appendChild(configScript);
    });

    // Get the config after loading
    if (typeof getHexConfig !== 'undefined') {
      const config = getHexConfig();
      hexConfig = config.getConfig();
    }
  }

  // Display mode indicator
  if (hexConfig.mockData) {
    document.querySelector('.ai-label').textContent = 'AI Agent Active (Demo Mode)';
  }

  // Initialize analytics
  initializeAnalytics();

  // Start real-time updates
  startRealtimeUpdates();

  // Set up event listeners
  setupEventListeners();

  // Load initial data
  loadAnalyticsData();
});

function initializeAnalytics() {
  // In a real implementation, these would be loaded from content script
  // For dashboard demo, we'll simulate the data

  console.log('Analytics systems initialized');
}

async function loadAnalyticsData() {
  // Get stored analytics data
  const stored = await chrome.storage.local.get(['analyticsData', 'hexConfig']);
  const hexConfig = stored.hexConfig;

  if (hexConfig.mockData) {
    // Generate demo data
    displayMockData();
  } else {
    // Load real data from Hex
    loadHexData();
  }
}

function displayMockData() {
  // Update real-time metrics
  updateMetric('current-severity', (Math.random() * 5).toFixed(1));
  updateMetric('click-accuracy', Math.floor(75 + Math.random() * 20) + '%');
  updateMetric('fatigue-level', Math.floor(Math.random() * 10));
  updateMetric('stress-indicator', Math.floor(Math.random() * 10));

  // Update progress bars
  updateProgressBar('fatigue-bar', Math.random() * 100);
  updateProgressBar('stress-bar', Math.random() * 100);

  // Update session stats
  updateSessionStats();

  // Generate AI insights
  generateAIInsights();

  // Create demo chart
  createTremorPatternChart();

  // Update predictions
  updatePredictions();

  // Update heatmap
  updateHeatmap();

  // Add AI console logs
  addConsoleLog('AI Agent initialized. Starting pattern analysis...');
  addConsoleLog('Loading tremor data from current session...');
  addConsoleLog('Analyzing patterns with machine learning models...');
  addConsoleLog('Generating personalized recommendations...');
}

function updateMetric(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

function updateProgressBar(id, percentage) {
  const bar = document.getElementById(id);
  if (bar) {
    bar.style.width = percentage + '%';
  }
}

function updateSessionStats() {
  // Calculate session duration
  const startTime = Date.now() - Math.floor(Math.random() * 3600000); // Random up to 1 hour
  const duration = Date.now() - startTime;
  const hours = Math.floor(duration / 3600000);
  const minutes = Math.floor((duration % 3600000) / 60000);
  const seconds = Math.floor((duration % 60000) / 1000);

  updateMetric('session-duration',
    `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
  updateMetric('peak-severity', (Math.random() * 10).toFixed(1));
  updateMetric('tremors-per-minute', Math.floor(Math.random() * 15));
  updateMetric('improvement-rate', '+' + Math.floor(Math.random() * 30) + '%');

  // Update optimal break time
  const breakTime = new Date(Date.now() + Math.random() * 3600000);
  updateMetric('optimal-break-time', breakTime.toLocaleTimeString());
}

function generateAIInsights() {
  const insights = [
    { icon: '💡', message: 'Periodic tremor pattern detected every 15 minutes', time: 'Just now' },
    { icon: '⚠️', message: 'Fatigue level increasing - consider a 10-minute break', time: '2 min ago' },
    { icon: '✨', message: 'Click accuracy improved by 15% in the last hour', time: '5 min ago' },
    { icon: '🎯', message: 'Optimal performance window: 10:00 AM - 12:00 PM', time: '10 min ago' }
  ];

  const insightsList = document.getElementById('ai-insights');
  if (insightsList) {
    insightsList.innerHTML = insights.map(insight => `
      <div class="insight-item">
        <span class="insight-icon">${insight.icon}</span>
        <div class="insight-content">
          <div class="insight-message">${insight.message}</div>
          <div class="insight-time">${insight.time}</div>
        </div>
      </div>
    `).join('');
  }

  // Update recommendations
  const recommendations = [
    'Take a 10-minute break at 3:30 PM for optimal recovery',
    'Enable larger click targets on complex websites',
    'Practice relaxation exercises to reduce stress-induced tremors',
    'Your tremor patterns suggest better performance in the morning',
    'Consider taking breaks during high-tremor periods'
  ];

  const recList = document.getElementById('recommendations-list');
  if (recList) {
    recList.innerHTML = recommendations.slice(0, 3).map(rec => `<li>${rec}</li>`).join('');
  }
}

function createTremorPatternChart() {
  const canvas = document.getElementById('tremor-pattern-chart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  // Generate sample data for 24 hours
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const severityData = hours.map(() => Math.random() * 8 + 1);
  const predictionData = hours.map(() => Math.random() * 7 + 2);

  // Simple line chart rendering (in production, use Chart.js)
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Set up dimensions
  const padding = 40;
  const width = canvas.width - 2 * padding;
  const height = canvas.height - 2 * padding;

  // Draw axes
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, canvas.height - padding);
  ctx.lineTo(canvas.width - padding, canvas.height - padding);
  ctx.strokeStyle = '#e5e5e7';
  ctx.stroke();

  // Draw severity line
  ctx.beginPath();
  ctx.strokeStyle = '#8B2635';
  ctx.lineWidth = 2;
  severityData.forEach((value, index) => {
    const x = padding + (index / 23) * width;
    const y = canvas.height - padding - (value / 10) * height;

    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();

  // Draw prediction line
  ctx.beginPath();
  ctx.strokeStyle = '#A8312F';
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.5;
  ctx.setLineDash([5, 5]);
  predictionData.forEach((value, index) => {
    const x = padding + (index / 23) * width;
    const y = canvas.height - padding - (value / 10) * height;

    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // Draw hour labels
  ctx.fillStyle = '#666';
  ctx.font = '11px sans-serif';
  [0, 6, 12, 18, 23].forEach(hour => {
    const x = padding + (hour / 23) * width;
    ctx.fillText(hour + ':00', x - 15, canvas.height - padding + 20);
  });
}

function updatePredictions() {
  const severity = Math.random() * 10;
  const confidence = 0.6 + Math.random() * 0.4;

  // Update severity bar
  const severityFill = document.getElementById('predicted-severity');
  if (severityFill) {
    severityFill.style.width = (severity * 10) + '%';
  }

  updateMetric('prediction-value', severity.toFixed(1));

  // Update confidence
  const confidenceFill = document.getElementById('confidence-level');
  if (confidenceFill) {
    confidenceFill.style.width = (confidence * 100) + '%';
  }

  updateMetric('confidence-percent', Math.floor(confidence * 100) + '%');

  // Update advice
  const advice = document.getElementById('prediction-advice');
  if (advice) {
    const messages = [
      'Tremor severity expected to decrease in the next hour',
      'Consider scheduling important tasks for the next 2 hours',
      'High confidence prediction - prepare for increased tremor activity',
      'Pattern analysis suggests stable conditions ahead'
    ];
    advice.textContent = messages[Math.floor(Math.random() * messages.length)];
  }
}

function updateHeatmap() {
  const canvas = document.getElementById('click-heatmap');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Generate random heatmap points
  for (let i = 0; i < 20; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const intensity = Math.random();

    // Draw heatmap point
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, 30);
    gradient.addColorStop(0, `rgba(139, 38, 53, ${intensity})`);
    gradient.addColorStop(1, 'rgba(139, 38, 53, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(x - 30, y - 30, 60, 60);
  }

  // Update stats
  updateMetric('total-clicks', Math.floor(100 + Math.random() * 400));
  updateMetric('miss-rate', Math.floor(5 + Math.random() * 20) + '%');
}

function addConsoleLog(message) {
  const consoleLog = document.getElementById('ai-console-log');
  if (!consoleLog) return;

  const time = new Date().toLocaleTimeString();
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML = `
    <span class="log-time">${time}</span>
    <span class="log-message">${message}</span>
  `;

  consoleLog.appendChild(entry);

  // Keep only last 10 entries
  while (consoleLog.children.length > 10) {
    consoleLog.removeChild(consoleLog.firstChild);
  }

  // Scroll to bottom
  consoleLog.scrollTop = consoleLog.scrollHeight;
}

function startRealtimeUpdates() {
  // Update dashboard every 5 seconds
  updateInterval = setInterval(() => {
    // Update metrics with slight variations
    const currentSeverity = parseFloat(document.getElementById('current-severity').textContent);
    const newSeverity = Math.max(0, Math.min(10, currentSeverity + (Math.random() - 0.5)));
    updateMetric('current-severity', newSeverity.toFixed(1));

    // Update trend arrows
    const trend = document.getElementById('severity-trend');
    if (trend) {
      trend.textContent = newSeverity > currentSeverity ? '↑' : newSeverity < currentSeverity ? '↓' : '→';
    }

    // Occasionally add new insights
    if (Math.random() > 0.7) {
      const messages = [
        'Pattern recognition complete',
        'Updating ML model with new data',
        'Synchronizing with Hex analytics',
        'Calculating optimal intervention timing',
        'Analyzing website interaction patterns'
      ];
      addConsoleLog(messages[Math.floor(Math.random() * messages.length)]);
    }

    // Update session duration
    updateSessionStats();

  }, 5000);
}

function setupEventListeners() {
  // Export buttons
  document.getElementById('export-pdf')?.addEventListener('click', () => {
    addConsoleLog('Generating PDF report...');
    setTimeout(() => {
      addConsoleLog('PDF report generated successfully');
      alert('PDF report would be downloaded (demo mode)');
    }, 1000);
  });

  document.getElementById('export-csv')?.addEventListener('click', () => {
    addConsoleLog('Exporting data to CSV...');
    setTimeout(() => {
      addConsoleLog('CSV export complete');
      alert('CSV data would be downloaded (demo mode)');
    }, 1000);
  });

  document.getElementById('share-doctor')?.addEventListener('click', () => {
    addConsoleLog('Preparing medical report...');
    setTimeout(() => {
      addConsoleLog('Medical report ready for sharing');
      alert('Medical report would be shared (demo mode)');
    }, 1000);
  });

  // Listen for updates from content script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'ANALYTICS_UPDATE') {
      // Update dashboard with real data
      console.log('Received analytics update:', message.data);
    }
  });
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (updateInterval) {
    clearInterval(updateInterval);
  }
});