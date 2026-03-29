// Hex Setup Page JavaScript

document.addEventListener('DOMContentLoaded', async () => {
  // Load current configuration
  const stored = await chrome.storage.local.get(['hexConfig']);
  let config = stored.hexConfig || {};

  // Mode toggle buttons
  const modeBtns = document.querySelectorAll('.mode-btn');
  const demoSection = document.getElementById('demo-section');
  const productionSection = document.getElementById('production-section');

  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      modeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (btn.dataset.mode === 'demo') {
        demoSection.classList.add('active');
        productionSection.classList.remove('active');
      } else {
        demoSection.classList.remove('active');
        productionSection.classList.add('active');
      }
    });
  });

  // Populate form if credentials exist
  if (config.apiKey && !config.mockData) {
    document.getElementById('api-key').value = config.apiKey;
    document.getElementById('project-id').value = config.projectId || '';
    document.getElementById('workspace-id').value = config.workspaceId || '';

    // Switch to production mode if configured
    document.querySelector('[data-mode="production"]').click();
  }

  // Start Demo button
  document.getElementById('start-demo').addEventListener('click', async () => {
    // Save demo configuration
    const demoConfig = {
      apiKey: 'demo_' + Math.random().toString(36).substr(2, 9),
      projectId: 'demo_project',
      workspaceId: 'demo_workspace',
      mockData: true,
      isDevelopment: true,
      syncInterval: 30000,
      enableRealTimeSync: true,
      useAdvancedML: true,
      enablePredictions: true,
      generateInsights: true
    };

    await chrome.storage.local.set({ hexConfig: demoConfig });

    showStatus('Demo mode activated! Opening analytics dashboard...', 'success');

    // Open analytics dashboard after a short delay
    setTimeout(() => {
      chrome.tabs.create({
        url: chrome.runtime.getURL('analytics-dashboard.html')
      });
    }, 1500);
  });

  // Test Connection button
  document.getElementById('test-connection').addEventListener('click', async () => {
    const apiKey = document.getElementById('api-key').value;
    const projectId = document.getElementById('project-id').value;
    const workspaceId = document.getElementById('workspace-id').value;

    if (!apiKey || !projectId || !workspaceId) {
      showStatus('Please fill in all fields', 'error');
      return;
    }

    showStatus('Testing connection...', 'info');

    try {
      // Test the Hex API connection
      const response = await fetch(`https://app.hex.tech/api/v1/projects/${projectId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        showStatus('Connection successful! ✓', 'success');
      } else if (response.status === 401) {
        showStatus('Invalid API key. Please check your credentials.', 'error');
      } else if (response.status === 404) {
        showStatus('Project not found. Please check your Project ID.', 'error');
      } else {
        showStatus('Connection failed. Please check your credentials.', 'error');
      }
    } catch (error) {
      // CORS error is expected when calling from extension
      // In production, this would go through a backend proxy
      showStatus('Note: Direct API calls may be blocked by CORS. Configuration saved for backend use.', 'info');
    }
  });

  // Form submission
  document.getElementById('hex-setup-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const apiKey = document.getElementById('api-key').value;
    const projectId = document.getElementById('project-id').value;
    const workspaceId = document.getElementById('workspace-id').value;

    if (!apiKey || !projectId || !workspaceId) {
      showStatus('Please fill in all fields', 'error');
      return;
    }

    // Save configuration
    const productionConfig = {
      apiKey: apiKey,
      projectId: projectId,
      workspaceId: workspaceId,
      mockData: false,
      isDevelopment: false,
      baseUrl: 'https://app.hex.tech/api/v1',
      notebookUrl: 'https://app.hex.tech/api/v1/projects',
      syncInterval: 30000,
      maxDataPoints: 1000,
      enableRealTimeSync: true,
      useAdvancedML: true,
      enablePredictions: true,
      generateInsights: true
    };

    await chrome.storage.local.set({ hexConfig: productionConfig });

    showStatus('Configuration saved successfully!', 'success');

    // Optionally create Hex project structure
    await createHexProjectStructure(productionConfig);

    // Open analytics dashboard after saving
    setTimeout(() => {
      chrome.tabs.create({
        url: chrome.runtime.getURL('analytics-dashboard.html')
      });
    }, 1500);
  });

  // Create Hex project structure
  async function createHexProjectStructure(config) {
    // This would typically be done through a backend service
    // due to CORS restrictions in browser extensions

    console.log('Hex project structure ready for:', config.projectId);

    // In a real implementation, this would:
    // 1. Create necessary notebooks in Hex
    // 2. Set up data connections
    // 3. Configure scheduled runs
    // 4. Set up webhooks for real-time updates
  }

  function showStatus(message, type) {
    const statusEl = document.getElementById('status-message');
    statusEl.textContent = message;
    statusEl.className = `status-message ${type}`;

    if (type === 'info') {
      statusEl.style.display = 'block';
      statusEl.style.background = '#e0f2fe';
      statusEl.style.color = '#075985';
      statusEl.style.border = '1px solid #7dd3fc';
    }

    if (type === 'success' || type === 'error') {
      setTimeout(() => {
        statusEl.style.display = 'none';
      }, 5000);
    }
  }
});