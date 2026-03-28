// Popup Script - Controls the extension UI

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const toggleBtn = document.getElementById('toggleBtn');
  const statusIndicator = document.querySelector('.status-dot');
  const toggleText = document.querySelector('.toggle-text');

  // Metrics elements
  const accuracyValue = document.getElementById('accuracyValue');
  const assistsValue = document.getElementById('assistsValue');
  const missesValue = document.getElementById('missesValue');
  const adaptValue = document.getElementById('adaptValue');

  // Settings elements
  const sensitivitySlider = document.getElementById('sensitivitySlider');
  const magneticSlider = document.getElementById('magneticSlider');
  const enlargeSlider = document.getElementById('enlargeSlider');
  const autoAdapt = document.getElementById('autoAdapt');
  const aiSidebar = document.getElementById('aiSidebar');

  // Value displays
  const sensitivityValue = document.getElementById('sensitivityValue');
  const magneticValue = document.getElementById('magneticValue');
  const enlargeValue = document.getElementById('enlargeValue');

  // Site info
  const siteUrl = document.getElementById('siteUrl');
  const issuesCount = document.getElementById('issuesCount');
  const fixedCount = document.getElementById('fixedCount');

  // State
  let isEnabled = false;
  let currentTab = null;

  // Initialize
  await init();

  async function init() {
    // Get current tab
    [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Get stored state
    const storage = await chrome.storage.local.get(['enabled', 'settings']);
    isEnabled = storage.enabled || false;

    // Update UI
    updateToggleUI();
    updateSiteInfo();

    // Load settings
    if (storage.settings) {
      sensitivitySlider.value = storage.settings.sensitivity * 100;
      magneticSlider.value = storage.settings.magneticStrength;
      enlargeSlider.value = storage.settings.enlargeScale * 100;
      autoAdapt.checked = storage.settings.autoAdapt;
      aiSidebar.checked = storage.settings.showAISidebar !== false; // Default to true
      updateSliderValues();
    }

    // Get current status from content script
    try {
      const response = await chrome.tabs.sendMessage(currentTab.id, { type: 'GET_STATUS' });
      if (response) {
        updateMetrics(response.metrics);
        checkWebSocketStatus();
      }
    } catch (error) {
      console.log('Content script not loaded yet');
    }

    // Get global metrics
    const globalMetrics = await chrome.storage.local.get('globalMetrics');
    if (globalMetrics.globalMetrics) {
      updateGlobalMetrics(globalMetrics.globalMetrics);
    }
  }

  // Toggle button handler
  toggleBtn.addEventListener('click', async () => {
    try {
      const response = await chrome.tabs.sendMessage(currentTab.id, { type: 'TOGGLE' });
      if (response.success) {
        isEnabled = !isEnabled;
        updateToggleUI();
        showNotification(isEnabled ? 'Accessibility enabled' : 'Accessibility disabled');
      }
    } catch (error) {
      console.error('Failed to toggle:', error);
      showNotification('Please refresh the page first', 'error');
    }
  });

  // Settings handlers
  sensitivitySlider.addEventListener('input', (e) => {
    const value = e.target.value;
    sensitivityValue.textContent = value + '%';
    updateSetting('sensitivity', value / 100);
  });

  magneticSlider.addEventListener('input', (e) => {
    const value = e.target.value;
    magneticValue.textContent = value + '%';
    updateSetting('magneticStrength', parseInt(value));
  });

  enlargeSlider.addEventListener('input', (e) => {
    const value = e.target.value;
    enlargeValue.textContent = (value / 100).toFixed(1) + 'x';
    updateSetting('enlargeScale', value / 100);
  });

  autoAdapt.addEventListener('change', (e) => {
    updateSetting('autoAdapt', e.target.checked);
  });

  aiSidebar.addEventListener('change', async (e) => {
    await updateSetting('showAISidebar', e.target.checked);
    // Send message to content script to toggle sidebar
    await chrome.tabs.sendMessage(currentTab.id, {
      type: e.target.checked ? 'SHOW_SIDEBAR' : 'HIDE_SIDEBAR'
    });
  });

  // Update settings
  async function updateSetting(key, value) {
    const storage = await chrome.storage.local.get('settings');
    const settings = storage.settings || {};
    settings[key] = value;

    await chrome.storage.local.set({ settings });

    // Send to content script
    try {
      await chrome.tabs.sendMessage(currentTab.id, {
        type: 'UPDATE_SETTINGS',
        settings: { [key]: value }
      });
    } catch (error) {
      console.log('Settings will apply on next page load');
    }
  }

  // Update slider value displays
  function updateSliderValues() {
    sensitivityValue.textContent = sensitivitySlider.value + '%';
    magneticValue.textContent = magneticSlider.value + '%';
    enlargeValue.textContent = (enlargeSlider.value / 100).toFixed(1) + 'x';
  }

  // Update toggle UI
  function updateToggleUI() {
    if (isEnabled) {
      toggleBtn.classList.add('active');
      toggleText.textContent = 'Disable Accessibility';
      statusIndicator.classList.add('connected');
    } else {
      toggleBtn.classList.remove('active');
      toggleText.textContent = 'Enable Accessibility';
      statusIndicator.classList.remove('connected');
    }
  }

  // Update metrics display
  function updateMetrics(metrics) {
    if (!metrics) return;

    accuracyValue.textContent = (metrics.currentAccuracy || 0) + '%';
    assistsValue.textContent = metrics.successfulClicks || 0;
    missesValue.textContent = metrics.missClicks?.length || 0;
    adaptValue.textContent = metrics.adaptations || 0;

    // Color code accuracy
    const accuracy = metrics.currentAccuracy || 100;
    accuracyValue.style.color = accuracy > 80 ? '#00ff88' : accuracy > 60 ? '#ff9500' : '#ff4444';
  }

  // Update global metrics
  function updateGlobalMetrics(metrics) {
    if (metrics.totalAssists) {
      const totalAssists = document.getElementById('assistsValue');
      if (totalAssists) {
        totalAssists.textContent = metrics.totalAssists;
      }
    }
  }

  // Update site info
  async function updateSiteInfo() {
    if (!currentTab) return;

    try {
      const url = new URL(currentTab.url);
      siteUrl.textContent = url.hostname;

      // Check for known issues on this site
      const storage = await chrome.storage.local.get('globalMetrics');
      if (storage.globalMetrics?.problemSites) {
        const siteData = storage.globalMetrics.problemSites.find(
          ([domain]) => domain === url.hostname
        );

        if (siteData) {
          issuesCount.textContent = siteData[1].reports || 0;
          fixedCount.textContent = Math.floor(siteData[1].reports * 0.7); // Estimate
        }
      }
    } catch (error) {
      siteUrl.textContent = 'Unknown';
    }
  }

  // Check WebSocket status
  async function checkWebSocketStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
      if (response.wsConnected) {
        statusIndicator.classList.add('connected');
      } else {
        statusIndicator.classList.add('error');
      }
    } catch (error) {
      statusIndicator.classList.add('error');
    }
  }

  // Footer buttons
  document.getElementById('helpBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://github.com/anthropics/claude-code' });
  });

  document.getElementById('reportBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://github.com/anthropics/claude-code/issues' });
  });

  // Show notification
  function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: ${type === 'error' ? '#ff4444' : '#00ff88'};
      color: ${type === 'error' ? 'white' : 'black'};
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 500;
      z-index: 1000;
      animation: fade-in 0.3s ease-out;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'fade-out 0.3s ease-out';
      setTimeout(() => notification.remove(), 300);
    }, 2000);
  }

  // Listen for updates from content script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'METRICS_UPDATE') {
      updateMetrics(message.data);
    }
  });

  // Auto-refresh metrics
  setInterval(async () => {
    if (currentTab) {
      try {
        const response = await chrome.tabs.sendMessage(currentTab.id, { type: 'GET_STATUS' });
        if (response) {
          updateMetrics(response.metrics);
        }
      } catch (error) {
        // Content script not loaded
      }
    }
  }, 2000);

  // Add CSS animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fade-in {
      from { opacity: 0; transform: translateX(-50%) translateY(10px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    @keyframes fade-out {
      from { opacity: 1; transform: translateX(-50%) translateY(0); }
      to { opacity: 0; transform: translateX(-50%) translateY(10px); }
    }
  `;
  document.head.appendChild(style);
});