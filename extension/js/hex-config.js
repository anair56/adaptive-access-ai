// Hex API Configuration for TremorSense
// This file manages the Hex integration settings

class HexConfig {
  constructor() {
    // YOUR Hex Workspace Token Configuration - Users don't need to set this up!
    this.config = {
      // Hex Workspace Token - Configured for your account
      workspaceToken: 'hxtw_179f2faa5d0b2a0a6ebb43f58d2ae617c934b526ed3c7f73b16551702dbf3034d78acfc180bb2cb06ba316e3916d2405',
      projectId: 'TremorSense-Analytics-032qH20mWsahimTong8CdU',  // Your TremorSense Analytics project

      // API Endpoints for workspace tokens
      baseUrl: 'https://app.hex.tech/api/v1',
      notebookUrl: 'https://app.hex.tech/api/v1/projects',

      // Analytics Settings
      syncInterval: 30000, // 30 seconds
      maxDataPoints: 1000,
      enableRealTimeSync: true,

      // Feature Flags
      useAdvancedML: true,
      enablePredictions: true,
      generateInsights: true,

      // Set to false once you add real credentials
      isDevelopment: false,
      mockData: false  // Will use real Hex API
    };

    this.initialized = false;
    this.init();
  }

  async init() {
    // Always use YOUR workspace token - no user setup needed!
    this.initialized = true;

    // Credentials are now configured!
    console.log('Hex API configured with your workspace token');
    console.log('Project: TremorSense-Analytics-032qH20mWsahimTong8CdU');
    this.config.mockData = false;  // Use real Hex API
    this.config.isDevelopment = false;

    // Save to storage for consistency
    await this.saveConfig();
  }

  async setupInitialConfig() {
    // Not needed anymore since we're using hardcoded credentials
    this.initialized = true;
  }

  async saveConfig() {
    await chrome.storage.local.set({ hexConfig: this.config });
  }

  async updateCredentials(apiKey, projectId, workspaceId) {
    this.config.apiKey = apiKey;
    this.config.projectId = projectId;
    this.config.workspaceId = workspaceId;
    this.config.mockData = false;
    this.config.isDevelopment = false;

    await this.saveConfig();
    return true;
  }

  isConfigured() {
    return this.config.apiKey && this.config.projectId && this.config.workspaceId;
  }

  getConfig() {
    return this.config;
  }

  // Mock API for development
  async mockApiCall(endpoint, data) {
    console.log('Mock Hex API call:', endpoint, data);

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Return mock responses based on endpoint
    if (endpoint.includes('/projects')) {
      return {
        success: true,
        project: {
          id: this.config.projectId,
          name: 'TremorSense Analytics (Demo)',
          cells: []
        }
      };
    }

    if (endpoint.includes('/run')) {
      return {
        success: true,
        execution_id: 'mock_exec_' + Date.now(),
        status: 'completed'
      };
    }

    if (endpoint.includes('/executions')) {
      return {
        status: 'completed',
        outputs: this.generateMockAnalysis()
      };
    }

    return { success: true };
  }

  generateMockAnalysis() {
    // Generate realistic mock data for development
    return {
      tremor_pattern_analysis: {
        data: {
          patterns: {
            periodic: Math.random() > 0.5,
            escalating: Math.random() > 0.7,
            stress_induced: Math.random() > 0.6,
            fatigue_related: Math.random() > 0.4
          }
        }
      },
      ml_prediction_model: {
        data: {
          next_hour_severity: Math.random() * 10,
          confidence: 0.7 + Math.random() * 0.3,
          model_r2: 0.8 + Math.random() * 0.2
        }
      },
      ai_recommendations: {
        data: {
          recommendations: [
            {
              type: 'break',
              priority: 'high',
              message: 'Consider taking a 10-minute break to reduce tremor severity',
              action: 'schedule_break'
            },
            {
              type: 'ui_adjustment',
              priority: 'medium',
              message: 'Enabling larger click targets for improved accuracy',
              action: 'enlarge_targets'
            }
          ]
        }
      }
    };
  }
}

// Singleton instance
let hexConfigInstance = null;

function getHexConfig() {
  if (!hexConfigInstance) {
    hexConfigInstance = new HexConfig();
  }
  return hexConfigInstance;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { HexConfig, getHexConfig };
}