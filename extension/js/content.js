// Adaptive Access AI - Content Script
// This runs on every webpage and provides real-time accessibility features

class AdaptiveAccessAI {
  constructor() {
    this.enabled = false;
    this.settings = {
      sensitivity: 0.5,
      magneticStrength: 70,
      enlargeScale: 1.5,
      tremorThreshold: 5,
      autoAdapt: true
    };

    this.metrics = {
      missClicks: [],
      successfulClicks: 0,
      totalClicks: 0,
      lastClickTime: 0,
      tremorDetected: false,
      currentAccuracy: 100
    };

    this.mousePosition = { x: 0, y: 0 };
    this.smoothPosition = { x: 0, y: 0 };
    this.velocity = { x: 0, y: 0 };
    this.tremorBuffer = [];
    this.magneticTargets = new Map();
    this.enhancedElements = new Set();
    this.clickableElements = new Set();

    this.init();
  }

  async init() {
    // Load settings from storage
    const stored = await chrome.storage.local.get(['enabled', 'settings']);
    if (stored.enabled) {
      this.enable();
    }
    if (stored.settings) {
      this.settings = { ...this.settings, ...stored.settings };
    }

    // Set up message listeners
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sendResponse);
      return true;
    });

    // Start monitoring
    this.setupEventListeners();
    this.scanForClickableElements();
    this.startMonitoring();

    console.log('🎯 Adaptive Access AI initialized on', window.location.hostname);
  }

  setupEventListeners() {
    // Track mouse movement
    document.addEventListener('mousemove', this.handleMouseMove.bind(this), true);

    // Track clicks
    document.addEventListener('click', this.handleClick.bind(this), true);
    document.addEventListener('mousedown', this.handleMouseDown.bind(this), true);

    // Track missed clicks (clicking on body or empty space)
    document.addEventListener('click', (e) => {
      if (this.isEmptySpace(e.target)) {
        this.recordMissClick(e);
      }
    });

    // Mutation observer for dynamic content
    const observer = new MutationObserver(() => {
      this.scanForClickableElements();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['disabled', 'aria-disabled']
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Alt+Shift+A to toggle
      if (e.altKey && e.shiftKey && e.key === 'A') {
        this.toggle();
      }
    });
  }

  handleMouseMove(e) {
    // Store raw position
    this.mousePosition = { x: e.clientX, y: e.clientY };

    // Calculate velocity
    const dt = 0.016; // ~60fps
    this.velocity.x = (e.movementX || 0) / dt;
    this.velocity.y = (e.movementY || 0) / dt;

    // Add to tremor buffer
    this.tremorBuffer.push({
      x: e.clientX,
      y: e.clientY,
      vx: this.velocity.x,
      vy: this.velocity.y,
      time: Date.now()
    });

    // Keep only last 500ms
    const cutoff = Date.now() - 500;
    this.tremorBuffer = this.tremorBuffer.filter(p => p.time > cutoff);

    // Detect tremor
    this.detectTremor();

    // Apply accessibility features if enabled
    if (this.enabled) {
      this.applyAccessibilityFeatures(e);
    }
  }

  detectTremor() {
    if (this.tremorBuffer.length < 10) return;

    // Calculate jitter (rapid direction changes)
    let directionChanges = 0;
    let totalMagnitude = 0;

    for (let i = 1; i < this.tremorBuffer.length; i++) {
      const prev = this.tremorBuffer[i - 1];
      const curr = this.tremorBuffer[i];

      // Check for direction change
      const dotProduct = prev.vx * curr.vx + prev.vy * curr.vy;
      if (dotProduct < 0) directionChanges++;

      // Sum velocity magnitude
      totalMagnitude += Math.sqrt(curr.vx * curr.vx + curr.vy * curr.vy);
    }

    const avgMagnitude = totalMagnitude / this.tremorBuffer.length;
    const changeRate = directionChanges / this.tremorBuffer.length;

    // Tremor detected if high frequency direction changes with moderate speed
    const hasTremor = changeRate > 0.3 && avgMagnitude > 100 && avgMagnitude < 1000;

    if (hasTremor !== this.metrics.tremorDetected) {
      this.metrics.tremorDetected = hasTremor;
      if (hasTremor) {
        this.onTremorDetected();
      }
    }
  }

  applyAccessibilityFeatures(e) {
    // Find nearest clickable element
    const nearest = this.findNearestClickable(e.clientX, e.clientY);

    if (nearest) {
      const { element, distance } = nearest;

      // Apply magnetic effect if close enough
      if (distance < 100) {
        this.applyMagneticEffect(element, distance);
      }

      // Apply cursor slowdown near targets
      if (distance < 50) {
        this.applyCursorSlowdown(distance);
      }

      // Enhance element if not already enhanced
      if (!this.enhancedElements.has(element)) {
        this.enhanceElement(element);
      }
    }
  }

  applyMagneticEffect(element, distance) {
    // Calculate magnetic pull strength
    const pullStrength = (1 - distance / 100) * (this.settings.magneticStrength / 100);

    if (pullStrength > 0.1) {
      // Add visual indicator
      if (!element.dataset.magnetic) {
        element.dataset.magnetic = 'true';
        element.style.transition = 'all 0.2s ease-out';
      }

      // Scale element based on proximity
      const scale = 1 + (pullStrength * 0.2);
      element.style.transform = `scale(${scale})`;

      // Add glow effect
      element.style.boxShadow = `0 0 ${20 * pullStrength}px rgba(0, 255, 136, ${pullStrength * 0.5})`;

      // Store in magnetic targets
      this.magneticTargets.set(element, {
        strength: pullStrength,
        distance: distance
      });
    }
  }

  applyCursorSlowdown(distance) {
    // This would require browser API support
    // For now, we'll add visual feedback
    document.body.style.cursor = distance < 25 ? 'pointer' : 'default';
  }

  enhanceElement(element) {
    const rect = element.getBoundingClientRect();

    // Skip if element is already reasonably sized
    if (rect.width >= 44 && rect.height >= 44) return;

    // Mark as enhanced
    this.enhancedElements.add(element);

    // Store original styles
    element.dataset.originalPadding = element.style.padding || '';
    element.dataset.originalFontSize = element.style.fontSize || '';

    // Enhance based on element type
    if (element.tagName === 'BUTTON' || element.tagName === 'A') {
      // Increase padding for better hit target
      const currentPadding = parseInt(window.getComputedStyle(element).padding) || 0;
      element.style.padding = `${Math.max(8, currentPadding * 1.5)}px`;

      // Increase font size slightly
      const currentFontSize = parseInt(window.getComputedStyle(element).fontSize) || 12;
      if (currentFontSize < 14) {
        element.style.fontSize = '14px';
      }
    }

    // Add accessibility indicator
    element.classList.add('aa-enhanced');

    // Add ARIA label
    if (!element.getAttribute('aria-label')) {
      element.setAttribute('aria-label', `Enhanced for accessibility: ${element.textContent || element.value || 'Interactive element'}`);
    }
  }

  handleClick(e) {
    const now = Date.now();
    const timeSinceLastClick = now - this.metrics.lastClickTime;
    this.metrics.lastClickTime = now;
    this.metrics.totalClicks++;

    // Check if this was a successful click
    const target = e.target;
    const isClickable = this.isClickableElement(target);

    if (isClickable) {
      this.metrics.successfulClicks++;
      this.onSuccessfulClick(target, timeSinceLastClick);
    } else {
      // Might be a miss-click
      if (timeSinceLastClick < 500) {
        this.recordMissClick(e);
      }
    }

    // Update accuracy
    this.updateAccuracy();
  }

  handleMouseDown(e) {
    // Visual feedback for click attempt
    if (this.enabled) {
      this.showClickFeedback(e.clientX, e.clientY, true);
    }
  }

  recordMissClick(e) {
    const missClick = {
      x: e.clientX,
      y: e.clientY,
      time: Date.now(),
      nearestElement: this.findNearestClickable(e.clientX, e.clientY)
    };

    this.metrics.missClicks.push(missClick);

    // Keep only recent miss-clicks
    const cutoff = Date.now() - 10000;
    this.metrics.missClicks = this.metrics.missClicks.filter(m => m.time > cutoff);

    // Check for pattern
    if (this.metrics.missClicks.length >= 3) {
      this.analyzeMissClickPattern();
    }

    // Visual feedback
    this.showClickFeedback(e.clientX, e.clientY, false);
  }

  analyzeMissClickPattern() {
    const recent = this.metrics.missClicks.slice(-5);

    // Find common target
    const targets = recent.map(m => m.nearestElement?.element).filter(Boolean);
    const targetCounts = {};
    targets.forEach(t => {
      const key = t.tagName + t.className;
      targetCounts[key] = (targetCounts[key] || 0) + 1;
    });

    // If same element missed multiple times, request help
    const maxCount = Math.max(...Object.values(targetCounts), 0);
    if (maxCount >= 3) {
      const problemElement = targets[targets.length - 1];
      this.requestAccessibilityHelp(problemElement);
    }
  }

  async requestAccessibilityHelp(element) {
    // Send to background script for Hermes processing
    const response = await chrome.runtime.sendMessage({
      type: 'ACCESSIBILITY_HELP_NEEDED',
      data: {
        element: {
          tagName: element.tagName,
          className: element.className,
          id: element.id,
          text: element.textContent?.substring(0, 50),
          rect: element.getBoundingClientRect()
        },
        metrics: this.metrics,
        url: window.location.href
      }
    });

    if (response?.success) {
      this.applyHermesRecommendations(element, response.recommendations);
    }
  }

  applyHermesRecommendations(element, recommendations) {
    recommendations.forEach(rec => {
      switch (rec.action) {
        case 'enlarge':
          this.enlargeElement(element, rec.scale || 1.5);
          break;
        case 'add_magnetic':
          this.addPermanentMagneticField(element, rec.strength || 80);
          break;
        case 'simplify':
          this.simplifyInteraction(element);
          break;
      }
    });

    this.showNotification('AI adapted interface for better accessibility');
  }

  enlargeElement(element, scale) {
    element.style.transform = `scale(${scale})`;
    element.style.transformOrigin = 'center';
    element.style.zIndex = '1000';
    element.classList.add('aa-enlarged');
  }

  addPermanentMagneticField(element, strength) {
    element.dataset.permanentMagnetic = strength;
    element.classList.add('aa-magnetic');
  }

  simplifyInteraction(element) {
    // Remove hover requirements
    element.onmouseenter = null;
    element.onmouseleave = null;

    // Make directly clickable
    if (element.parentElement?.onclick && !element.onclick) {
      element.onclick = element.parentElement.onclick;
    }
  }

  findNearestClickable(x, y) {
    let nearest = null;
    let minDistance = Infinity;

    this.clickableElements.forEach(element => {
      const rect = element.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));

      if (distance < minDistance) {
        minDistance = distance;
        nearest = element;
      }
    });

    return nearest ? { element: nearest, distance: minDistance } : null;
  }

  scanForClickableElements() {
    // Find all potentially clickable elements
    const selectors = [
      'button',
      'a',
      'input[type="button"]',
      'input[type="submit"]',
      '[role="button"]',
      '[onclick]',
      '.btn',
      '.button'
    ];

    this.clickableElements.clear();
    selectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        if (this.isVisible(el)) {
          this.clickableElements.add(el);
        }
      });
    });

    // Check for accessibility issues
    this.checkAccessibilityIssues();
  }

  checkAccessibilityIssues() {
    let issues = 0;

    this.clickableElements.forEach(element => {
      const rect = element.getBoundingClientRect();

      // Check for WCAG minimum size (44x44px)
      if (rect.width < 44 || rect.height < 44) {
        issues++;
        element.classList.add('aa-small-target');
      }

      // Check for low contrast
      const styles = window.getComputedStyle(element);
      const bgColor = styles.backgroundColor;
      const color = styles.color;
      if (this.calculateContrast(bgColor, color) < 4.5) {
        issues++;
        element.classList.add('aa-low-contrast');
      }
    });

    if (issues > 0 && this.enabled && this.settings.autoAdapt) {
      this.autoFixAccessibilityIssues();
    }
  }

  autoFixAccessibilityIssues() {
    // Fix small targets
    document.querySelectorAll('.aa-small-target').forEach(element => {
      if (!this.enhancedElements.has(element)) {
        this.enhanceElement(element);
      }
    });

    // Fix low contrast
    document.querySelectorAll('.aa-low-contrast').forEach(element => {
      element.style.filter = 'contrast(1.2)';
    });
  }

  isClickableElement(element) {
    const clickableTags = ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'];
    return clickableTags.includes(element.tagName) ||
           element.onclick ||
           element.hasAttribute('role') ||
           element.classList.contains('btn') ||
           element.classList.contains('button');
  }

  isEmptySpace(element) {
    return element === document.body ||
           element === document.documentElement ||
           (!this.isClickableElement(element) && !element.textContent?.trim());
  }

  isVisible(element) {
    const rect = element.getBoundingClientRect();
    const styles = window.getComputedStyle(element);

    return rect.width > 0 &&
           rect.height > 0 &&
           styles.display !== 'none' &&
           styles.visibility !== 'hidden' &&
           styles.opacity !== '0';
  }

  calculateContrast(bg, fg) {
    // Simple contrast calculation (would be more complex in production)
    return 5; // Placeholder
  }

  showClickFeedback(x, y, success) {
    const feedback = document.createElement('div');
    feedback.className = success ? 'aa-click-success' : 'aa-click-miss';
    feedback.style.left = x + 'px';
    feedback.style.top = y + 'px';
    document.body.appendChild(feedback);

    setTimeout(() => feedback.remove(), 1000);
  }

  showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'aa-notification';
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.add('aa-fade-out');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  onTremorDetected() {
    // Send tremor detection to background
    chrome.runtime.sendMessage({
      type: 'TREMOR_DETECTED',
      data: {
        frequency: this.estimateTremorFrequency(),
        severity: 'medium'
      }
    });

    // Auto-enable if not already
    if (!this.enabled && this.settings.autoAdapt) {
      this.enable();
      this.showNotification('Tremor detected - enabling accessibility features');
    }
  }

  estimateTremorFrequency() {
    if (this.tremorBuffer.length < 2) return 0;

    let changes = 0;
    for (let i = 1; i < this.tremorBuffer.length; i++) {
      const prev = this.tremorBuffer[i - 1];
      const curr = this.tremorBuffer[i];
      if (Math.sign(prev.vx) !== Math.sign(curr.vx)) changes++;
    }

    const timeSpan = (this.tremorBuffer[this.tremorBuffer.length - 1].time - this.tremorBuffer[0].time) / 1000;
    return changes / timeSpan / 2; // Hz
  }

  onSuccessfulClick(element, timeToClick) {
    // Send success metric
    chrome.runtime.sendMessage({
      type: 'CLICK_SUCCESS',
      data: {
        element: element.tagName,
        timeToClick: timeToClick,
        enhanced: this.enhancedElements.has(element)
      }
    });

    // Remove magnetic effect
    if (element.dataset.magnetic) {
      delete element.dataset.magnetic;
      element.style.transform = '';
      element.style.boxShadow = '';
    }
  }

  updateAccuracy() {
    if (this.metrics.totalClicks > 0) {
      this.metrics.currentAccuracy = Math.round(
        (this.metrics.successfulClicks / this.metrics.totalClicks) * 100
      );

      // Send to popup
      chrome.runtime.sendMessage({
        type: 'METRICS_UPDATE',
        data: this.metrics
      });
    }
  }

  startMonitoring() {
    // Periodic accessibility check
    setInterval(() => {
      if (this.enabled) {
        this.scanForClickableElements();
        this.cleanupMagneticTargets();
      }
    }, 5000);

    // Report metrics periodically
    setInterval(() => {
      if (this.metrics.totalClicks > 0) {
        chrome.runtime.sendMessage({
          type: 'METRICS_REPORT',
          data: {
            ...this.metrics,
            url: window.location.href,
            timestamp: Date.now()
          }
        });
      }
    }, 30000);
  }

  cleanupMagneticTargets() {
    // Remove magnetic effects from distant elements
    this.magneticTargets.forEach((data, element) => {
      if (data.distance > 100) {
        element.style.transform = '';
        element.style.boxShadow = '';
        delete element.dataset.magnetic;
        this.magneticTargets.delete(element);
      }
    });
  }

  handleMessage(message, sendResponse) {
    switch (message.type) {
      case 'TOGGLE':
        this.toggle();
        sendResponse({ success: true, enabled: this.enabled });
        break;

      case 'ENABLE':
        this.enable();
        sendResponse({ success: true });
        break;

      case 'DISABLE':
        this.disable();
        sendResponse({ success: true });
        break;

      case 'UPDATE_SETTINGS':
        this.settings = { ...this.settings, ...message.settings };
        chrome.storage.local.set({ settings: this.settings });
        sendResponse({ success: true });
        break;

      case 'GET_STATUS':
        sendResponse({
          enabled: this.enabled,
          metrics: this.metrics,
          settings: this.settings
        });
        break;
    }
  }

  enable() {
    this.enabled = true;
    document.body.classList.add('aa-enabled');
    chrome.storage.local.set({ enabled: true });
    this.showNotification('Adaptive Access AI enabled');

    // Initial scan
    this.scanForClickableElements();
  }

  disable() {
    this.enabled = false;
    document.body.classList.remove('aa-enabled');
    chrome.storage.local.set({ enabled: false });
    this.showNotification('Adaptive Access AI disabled');

    // Cleanup
    this.cleanupEnhancements();
  }

  toggle() {
    if (this.enabled) {
      this.disable();
    } else {
      this.enable();
    }
  }

  cleanupEnhancements() {
    // Remove all enhancements
    this.enhancedElements.forEach(element => {
      element.style.padding = element.dataset.originalPadding || '';
      element.style.fontSize = element.dataset.originalFontSize || '';
      element.classList.remove('aa-enhanced', 'aa-enlarged', 'aa-magnetic');
      delete element.dataset.originalPadding;
      delete element.dataset.originalFontSize;
      delete element.dataset.magnetic;
      delete element.dataset.permanentMagnetic;
    });

    this.enhancedElements.clear();
    this.magneticTargets.clear();

    // Remove all visual indicators
    document.querySelectorAll('.aa-small-target, .aa-low-contrast').forEach(el => {
      el.classList.remove('aa-small-target', 'aa-low-contrast');
    });
  }
}

// Initialize
const adaptiveAI = new AdaptiveAccessAI();