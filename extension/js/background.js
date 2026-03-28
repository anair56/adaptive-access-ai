// Background Service Worker - Handles Hermes API calls and coordination

const HERMES_API_URL = 'http://localhost:3000/analyze';
const WS_URL = 'ws://localhost:8080';

class HermesAccessibilityService {
  constructor() {
    this.ws = null;
    this.metrics = {
      totalSessions: 0,
      totalAssists: 0,
      problemSites: new Map()
    };
    this.activeTabData = new Map();
    this.init();
  }

  init() {
    // Set up WebSocket connection
    this.connectWebSocket();

    // Message handlers
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true;
    });

    // Command listeners
    chrome.commands.onCommand.addListener((command) => {
      if (command === 'toggle-accessibility') {
        this.toggleAccessibility();
      }
    });

    // Tab listeners
    chrome.tabs.onActivated.addListener((activeInfo) => {
      this.updateActiveTab(activeInfo.tabId);
    });

    chrome.tabs.onRemoved.addListener((tabId) => {
      this.activeTabData.delete(tabId);
    });

    console.log('🎯 Hermes Accessibility Service initialized');
  }

  connectWebSocket() {
    try {
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        console.log('✅ Connected to Hermes server');
        this.updateBadge('ON', '#00ff88');
      };

      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        this.handleHermesResponse(data);
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.updateBadge('!', '#ff4444');
      };

      this.ws.onclose = () => {
        console.log('WebSocket closed, reconnecting...');
        this.updateBadge('OFF', '#888888');
        setTimeout(() => this.connectWebSocket(), 5000);
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      // Fall back to HTTP API
    }
  }

  async handleMessage(message, sender, sendResponse) {
    const tabId = sender.tab?.id;

    switch (message.type) {
      case 'ACCESSIBILITY_HELP_NEEDED':
        const recommendations = await this.getHermesRecommendations(message.data);
        sendResponse({ success: true, recommendations });
        break;

      case 'TREMOR_DETECTED':
        this.handleTremorDetection(message.data, tabId);
        sendResponse({ success: true });
        break;

      case 'METRICS_UPDATE':
        this.updateMetrics(message.data, tabId);
        sendResponse({ success: true });
        break;

      case 'CLICK_SUCCESS':
        this.recordSuccess(message.data, tabId);
        sendResponse({ success: true });
        break;

      case 'METRICS_REPORT':
        this.processMetricsReport(message.data, tabId);
        sendResponse({ success: true });
        break;

      case 'GET_STATUS':
        const status = await this.getSystemStatus();
        sendResponse(status);
        break;

      case 'TOGGLE':
        await this.toggleAccessibility();
        sendResponse({ success: true });
        break;

      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  }

  async getHermesRecommendations(data) {
    // Prepare context for Hermes
    const context = {
      action: 'analyze_accessibility_issue',
      element: data.element,
      metrics: data.metrics,
      url: data.url,
      timestamp: Date.now()
    };

    try {
      // Send to Hermes via WebSocket if connected
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(context));

        // Wait for response (would use promises in production)
        return await this.waitForHermesResponse();
      } else {
        // Fallback to HTTP API
        return await this.callHermesHTTP(context);
      }
    } catch (error) {
      console.error('Hermes call failed:', error);
      // Return default recommendations
      return this.getDefaultRecommendations(data);
    }
  }

  async callHermesHTTP(context) {
    try {
      const response = await fetch(HERMES_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(context)
      });

      const result = await response.json();

      if (result.success && result.functions) {
        return this.parseHermesFunctions(result.functions);
      }
    } catch (error) {
      console.error('HTTP call to Hermes failed:', error);
    }

    return this.getDefaultRecommendations(context);
  }

  parseHermesFunctions(functions) {
    const recommendations = [];

    functions.forEach(func => {
      switch (func.name) {
        case 'enlargeClickTarget':
          recommendations.push({
            action: 'enlarge',
            scale: func.arguments.scale
          });
          break;

        case 'addMagneticSnap':
          recommendations.push({
            action: 'add_magnetic',
            strength: func.arguments.strength
          });
          break;

        case 'adjustCursorSensitivity':
          recommendations.push({
            action: 'adjust_sensitivity',
            sensitivity: func.arguments.sensitivity
          });
          break;

        case 'simplifyInteraction':
          recommendations.push({
            action: 'simplify'
          });
          break;
      }
    });

    return recommendations;
  }

  getDefaultRecommendations(data) {
    const recommendations = [];
    const metrics = data.metrics || {};

    // Based on miss-click count
    if (metrics.missClicks?.length > 3) {
      recommendations.push({
        action: 'enlarge',
        scale: 1.5
      });
      recommendations.push({
        action: 'add_magnetic',
        strength: 75
      });
    }

    // Based on tremor detection
    if (metrics.tremorDetected) {
      recommendations.push({
        action: 'adjust_sensitivity',
        sensitivity: 0.3
      });
    }

    // Based on element size
    if (data.element?.rect) {
      const { width, height } = data.element.rect;
      if (width < 44 || height < 44) {
        recommendations.push({
          action: 'enlarge',
          scale: Math.max(44 / width, 44 / height)
        });
      }
    }

    return recommendations;
  }

  async waitForHermesResponse() {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(this.getDefaultRecommendations({}));
      }, 2000);

      const handler = (event) => {
        const data = JSON.parse(event.data);
        if (data.functions) {
          clearTimeout(timeout);
          this.ws.removeEventListener('message', handler);
          resolve(this.parseHermesFunctions(data.functions));
        }
      };

      this.ws.addEventListener('message', handler);
    });
  }

  handleHermesResponse(data) {
    console.log('Hermes response:', data);

    // Send to active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'HERMES_RESPONSE',
          data: data
        });
      }
    });
  }

  handleTremorDetection(data, tabId) {
    console.log(`Tremor detected in tab ${tabId}:`, data);

    // Record for this site
    if (tabId) {
      const tabData = this.activeTabData.get(tabId) || {};
      tabData.tremorDetected = true;
      tabData.tremorFrequency = data.frequency;
      this.activeTabData.set(tabId, tabData);
    }

    // Send automatic assistance
    this.sendAutoAssistance(tabId);
  }

  async sendAutoAssistance(tabId) {
    if (!tabId) return;

    // Send Hermes-powered assistance
    const assistance = {
      type: 'AUTO_ASSISTANCE',
      recommendations: [
        { action: 'adjust_sensitivity', sensitivity: 0.3 },
        { action: 'add_magnetic', strength: 60 }
      ]
    };

    chrome.tabs.sendMessage(tabId, assistance);
  }

  updateMetrics(data, tabId) {
    if (!tabId) return;

    const tabData = this.activeTabData.get(tabId) || {};
    tabData.metrics = data;
    tabData.lastUpdate = Date.now();
    this.activeTabData.set(tabId, tabData);

    // Update badge with accuracy
    if (data.currentAccuracy !== undefined) {
      this.updateBadge(`${data.currentAccuracy}%`,
        data.currentAccuracy > 80 ? '#00ff88' : '#ff9500');
    }
  }

  recordSuccess(data, tabId) {
    this.metrics.totalAssists++;

    if (tabId) {
      const tabData = this.activeTabData.get(tabId) || {};
      tabData.successCount = (tabData.successCount || 0) + 1;
      this.activeTabData.set(tabId, tabData);
    }
  }

  processMetricsReport(data, tabId) {
    const url = new URL(data.url);
    const domain = url.hostname;

    // Track problem sites
    if (data.currentAccuracy < 70) {
      const siteData = this.problemSites.get(domain) || {
        reports: 0,
        avgAccuracy: 0
      };
      siteData.reports++;
      siteData.avgAccuracy = (siteData.avgAccuracy * (siteData.reports - 1) + data.currentAccuracy) / siteData.reports;
      this.problemSites.set(domain, siteData);
    }

    // Store metrics
    chrome.storage.local.set({
      globalMetrics: {
        totalSessions: this.metrics.totalSessions,
        totalAssists: this.metrics.totalAssists,
        problemSites: Array.from(this.problemSites.entries())
      }
    });
  }

  async toggleAccessibility() {
    // Send toggle to active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE' });
    }
  }

  async updateActiveTab(tabId) {
    // Get tab info
    const tab = await chrome.tabs.get(tabId);

    // Initialize tab data if needed
    if (!this.activeTabData.has(tabId)) {
      this.activeTabData.set(tabId, {
        url: tab.url,
        startTime: Date.now(),
        successCount: 0
      });
    }
  }

  updateBadge(text, color) {
    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({ color });
  }

  async getSystemStatus() {
    const storage = await chrome.storage.local.get(['enabled', 'settings', 'globalMetrics']);

    return {
      enabled: storage.enabled || false,
      settings: storage.settings || {},
      metrics: storage.globalMetrics || {},
      wsConnected: this.ws && this.ws.readyState === WebSocket.OPEN,
      activeTabData: Array.from(this.activeTabData.entries())
    };
  }
}

// Initialize service
const hermesService = new HermesAccessibilityService();

// Installation handler
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Set default settings
    chrome.storage.local.set({
      enabled: false,
      settings: {
        sensitivity: 0.5,
        magneticStrength: 70,
        enlargeScale: 1.5,
        tremorThreshold: 5,
        autoAdapt: true
      }
    });

    // Open welcome page (local demo)
    chrome.tabs.create({
      url: 'chrome://extensions/'
    });
  }
});