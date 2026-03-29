// Popup Script - Controls the extension UI

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const toggleBtn = document.getElementById('toggleBtn');
  const toggleText = document.querySelector('.toggle-text');
  // Status indicator no longer exists in new design
  const statusIndicator = null;

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

  // Site info - removed in new design
  const siteUrl = null;
  const issuesCount = null;
  const fixedCount = null;

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

    initCreatorHub();

    // Get global metrics
    const globalMetrics = await chrome.storage.local.get('globalMetrics');
    if (globalMetrics.globalMetrics) {
      updateGlobalMetrics(globalMetrics.globalMetrics);
    }
  }

  // Toggle button handler
  toggleBtn.addEventListener('click', async () => {
    if (!currentTab || !currentTab.id) {
      showNotification('Unable to detect current tab', 'error');
      return;
    }

    // Check if we're on a restricted page
    if (currentTab.url && (currentTab.url.startsWith('chrome://') ||
        currentTab.url.startsWith('chrome-extension://') ||
        currentTab.url.startsWith('edge://') ||
        currentTab.url.startsWith('about:'))) {
      showNotification('Cannot run on browser pages', 'error');
      return;
    }

    try {
      const response = await chrome.tabs.sendMessage(currentTab.id, { type: 'TOGGLE' });
      if (response && response.success) {
        isEnabled = !isEnabled;
        updateToggleUI();
        showNotification(isEnabled ? 'Accessibility enabled' : 'Accessibility disabled');
      }
    } catch (error) {
      console.log('Toggle error:', error.message);
      // Try to inject the content script if it's not loaded
      try {
        await chrome.scripting.executeScript({
          target: { tabId: currentTab.id },
          files: ['js/content.js']
        });
        await chrome.scripting.insertCSS({
          target: { tabId: currentTab.id },
          files: ['css/accessibility.css']
        });
        showNotification('Extension loaded! Please try again', 'success');
      } catch (injectError) {
        console.log('Could not inject scripts:', injectError.message);
        showNotification('Please refresh the page first', 'error');
      }
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
    try {
      if (currentTab && currentTab.id) {
        await chrome.tabs.sendMessage(currentTab.id, {
          type: e.target.checked ? 'SHOW_SIDEBAR' : 'HIDE_SIDEBAR'
        });
      }
    } catch (error) {
      console.log('Could not toggle sidebar:', error.message);
    }
  });

  // Update settings
  async function updateSetting(key, value) {
    const storage = await chrome.storage.local.get('settings');
    const settings = storage.settings || {};
    settings[key] = value;

    await chrome.storage.local.set({ settings });

    // Send to content script
    try {
      if (currentTab && currentTab.id) {
        await chrome.tabs.sendMessage(currentTab.id, {
          type: 'UPDATE_SETTINGS',
          settings: { [key]: value }
        });
      }
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
      // No status indicator in new design
    } else {
      toggleBtn.classList.remove('active');
      toggleText.textContent = 'Enable Accessibility';
      // No status indicator in new design
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
    // Site info elements removed in new design
    // This function is now a no-op but kept for compatibility
    return;
  }

  // Check WebSocket status
  async function checkWebSocketStatus() {
    // Status indicator was removed in new design
    // Just log the status for debugging if needed
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
      console.log('WebSocket status:', response.wsConnected ? 'connected' : 'disconnected');
    } catch (error) {
      console.log('Could not get WebSocket status:', error);
    }
  }

  // Footer buttons - removed as they don't exist in new design
  // Help and report buttons were removed in the modern UI redesign

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
    if (currentTab && currentTab.id) {
      try {
        const response = await chrome.tabs.sendMessage(currentTab.id, { type: 'GET_STATUS' });
        if (response) {
          updateMetrics(response.metrics);
        }
      } catch (error) {
        // Content script not loaded - silently ignore
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
  function initCreatorHub() {
  const creatorHubContainer = document.getElementById('creatorHub');

  const buttons = [
    { label: 'Make Website', icon: '🌐', url: 'https://www.wix.com/start/website' },
    { label: 'Send Email', icon: '✉️', url: 'https://mail.google.com/' },
    { label: 'Design in Canva', icon: '🎨', url: 'https://www.canva.com/' },
    { label: 'Fiverr / Freelance', icon: '🖥️', url: 'https://www.fiverr.com/' },
    { label: 'Payment Portal', icon: '💰', url: 'https://www.paypal.com/' },
    { label: 'Social Scheduler', icon: '📅', url: 'https://later.com/' },
    { label: 'Upload Music', icon: '🎵', url: 'https://soundcloud.com/' },
    { label: 'Copy Affiliate Link', icon: '📋', action: () => {
        navigator.clipboard.writeText('https://your-affiliate-link.com');
        showNotification('Affiliate link copied!');
      }
    },
  ];


  buttons.forEach(btn => {
    const element = document.createElement('button');

    // Add icon + label
    element.innerHTML = `<span class="button-icon">${btn.icon}</span><span class="button-label">${btn.label}</span>`;

    // Dark-themed styling to match the popup
    element.style.cssText = `
      width: 100%;
      padding: 10px 14px;
      margin: 6px 0;
      font-size: 14px;
      font-weight: 500;
      color: #333;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 10px;
      justify-content: center;
      transition: all 0.25s ease;
      box-shadow: 0 4px 8px rgba(0,0,0,0.25);
    `;

    // Hover effect (lighter background + subtle glow)
    element.addEventListener('mouseenter', () => {
      element.style.background = 'rgba(0, 255, 136, 0.1)';
      element.style.color = '#00ff88';
      element.style.transform = 'translateY(-2px)';
      element.style.boxShadow = '0 6px 12px rgba(0,255,136,0.3)';
    });

    element.addEventListener('mouseleave', () => {
      element.style.background = 'rgba(255, 255, 255, 0.05)';
      element.style.color = '#333';
      element.style.transform = 'translateY(0)';
      element.style.boxShadow = '0 4px 8px rgba(0,0,0,0.25)';
    });

    // Action
    element.addEventListener('click', () => {
      if (btn.url) chrome.tabs.create({ url: btn.url });
      if (btn.action) btn.action();
    });

    creatorHubContainer.appendChild(element);
  });
}

  // Footer buttons removed in modern UI design
});