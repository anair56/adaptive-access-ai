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

    this.agenticFocusElement = null;
    this.agenticCooldownUntil = 0;
    this.agentEscalation = false;
    this.postAssistMissStreak = 0;
    this.interventionGeneration = 0;
    this.motorRailEl = null;
    this.motorRailVisible = false;
    this.railLiveRegion = null;
    this.lastMissDedupe = { t: 0, x: 0, y: 0 };
    this.refreshRailScheduled = null;
    this.onRailKeydownBound = this.onRailHotkey.bind(this);
    this.motorRailChipTargets = new WeakMap();
    this.agentSessionForWindow = false;

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
      // Check if AI sidebar should be shown (default to true if not set)
      if (stored.settings.showAISidebar !== false && stored.enabled) {
        this.createAISidebar();
      }
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

    // Mutation observer for dynamic content
    const observer = new MutationObserver(() => {
      this.scanForClickableElements();
      this.scheduleRailRefresh();
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

    const target = e.target;
    const isClickable = this.isClickableElement(target);
    const nearest = this.findNearestClickable(e.clientX, e.clientY);

    if (isClickable) {
      this.metrics.successfulClicks++;
      this.onSuccessfulClick(target, timeSinceLastClick);
      if (this.interventionGeneration > 0) {
        this.postAssistMissStreak = 0;
        this.agentEscalation = false;
      }
    } else {
      const empty = this.isEmptySpace(target);
      const nearMiss =
        nearest &&
        nearest.distance > 4 &&
        nearest.distance < 115 &&
        !this.motorRailEl?.contains(target);

      if (empty || nearMiss) {
        this.recordMissClick(e, nearest);
      } else if (timeSinceLastClick < 450 && nearest && nearest.distance >= 115) {
        this.recordMissClick(e, nearest);
      }
    }

    this.updateAccuracy();
  }

  handleMouseDown(e) {
    // Visual feedback for click attempt
    if (this.enabled) {
      this.showClickFeedback(e.clientX, e.clientY, true);
    }
  }

  recordMissClick(e, nearestPrecomputed = null) {
    const t = Date.now();
    const x = e.clientX;
    const y = e.clientY;
    if (t - this.lastMissDedupe.t < 380 && Math.hypot(x - this.lastMissDedupe.x, y - this.lastMissDedupe.y) < 14) {
      return;
    }
    this.lastMissDedupe = { t, x, y };

    const missClick = {
      x,
      y,
      time: t,
      nearestElement: nearestPrecomputed || this.findNearestClickable(x, y)
    };

    this.metrics.missClicks.push(missClick);

    const windowMs = 16000;
    const cutoff = Date.now() - windowMs;
    this.metrics.missClicks = this.metrics.missClicks.filter(m => m.time > cutoff);

    if (this.metrics.missClicks.length < 3) {
      this.agentSessionForWindow = false;
    }

    if (this.interventionGeneration > 0) {
      this.postAssistMissStreak++;
      if (this.postAssistMissStreak >= 2) {
        this.agentEscalation = true;
        this.runAgenticAssistLoop({ forceApi: true });
        this.postAssistMissStreak = 0;
      }
    }

    if (this.metrics.missClicks.length >= 3) {
      this.analyzeMissClickPattern();
      if (!this.agentSessionForWindow) {
        this.agentSessionForWindow = true;
        this.runAgenticAssistLoop({ forceApi: false });
      } else {
        // Disabled motor rail - using AI sidebar instead
        // this.showMotorShortcutRail({ fromAgent: false, announce: 'Updating shortcuts from your last clicks.' });
      }
    }

    this.showClickFeedback(x, y, false);
  }

  analyzeMissClickPattern() {
    const recent = this.metrics.missClicks.slice(-6);
    const targets = recent.map(m => m.nearestElement?.element).filter(Boolean);
    const targetCounts = {};
    targets.forEach(t => {
      const key = `${t.tagName}|${t.className}|${t.id}`;
      targetCounts[key] = (targetCounts[key] || 0) + 1;
    });
    const maxCount = Math.max(...Object.values(targetCounts), 0);
    if (maxCount >= 2 && targets.length) {
      this.agenticFocusElement = targets[targets.length - 1];
    }
  }

  scheduleRailRefresh() {
    if (!this.motorRailVisible) return;
    if (this.refreshRailScheduled) clearTimeout(this.refreshRailScheduled);
    this.refreshRailScheduled = setTimeout(() => {
      this.refreshRailScheduled = null;
      if (this.motorRailEl) {
        this.populateMotorRail();
      }
    }, 320);
  }

  runAgenticAssistLoop({ forceApi = false } = {}) {
    if (!this.enabled || !this.settings.autoAdapt) return;

    const recentMisses = this.metrics.missClicks.length;
    if (recentMisses < 3 && !forceApi) return;

    if (!this.agenticFocusElement) {
      const last = this.metrics.missClicks[this.metrics.missClicks.length - 1];
      this.agenticFocusElement = last?.nearestElement?.element || null;
    }

    const now = Date.now();
    if (!forceApi && now < this.agenticCooldownUntil) {
      // Disabled motor rail - using AI sidebar instead
      // this.showMotorShortcutRail({ fromAgent: false, announce: 'Shortcuts updated after mis-clicks.' });
      return;
    }

    this.agenticCooldownUntil = now + 11000;
    const el = this.agenticFocusElement;
    this.requestAccessibilityHelp(el, { escalation: this.agentEscalation });
  }

  async requestAccessibilityHelp(element, opts = {}) {
    const payloadElement =
      element &&
      (element.nodeType === 1
        ? {
            tagName: element.tagName,
            className: element.className,
            id: element.id,
            text: element.textContent?.substring(0, 80),
            rect: element.getBoundingClientRect()
          }
        : element);

    const response = await chrome.runtime.sendMessage({
      type: 'ACCESSIBILITY_HELP_NEEDED',
      data: {
        element: payloadElement,
        metrics: {
          ...this.metrics,
          escalation: opts.escalation === true
        },
        url: window.location.href,
        escalation: opts.escalation === true
      }
    });

    if (response?.success && Array.isArray(response.recommendations)) {
      this.interventionGeneration++;
      if (response.recommendations.length) {
        this.applyHermesRecommendations(element, response.recommendations);
      } else {
        // Disabled motor rail - using AI sidebar instead
        // this.showMotorShortcutRail({
        //   fromAgent: false,
        //   announce: 'Opened shortcuts from your recent click pattern.'
        // });
      }
    } else {
      this.interventionGeneration++;
      // Disabled motor rail - using AI sidebar instead
      // this.showMotorShortcutRail({
      //   fromAgent: false,
      //   announce: 'Showing local shortcuts while the AI service is offline.'
      // });
    }
  }

  hermesFunctionsToRecommendations(functions) {
    if (!Array.isArray(functions)) return [];
    const recs = [];
    for (const func of functions) {
      const name = func.name;
      const a = func.arguments || {};
      switch (name) {
        case 'enlargeClickTarget':
          recs.push({ action: 'enlarge', scale: a.scale });
          break;
        case 'addMagneticSnap':
          recs.push({ action: 'add_magnetic', strength: a.strength });
          break;
        case 'adjustCursorSensitivity':
          recs.push({ action: 'adjust_sensitivity', sensitivity: a.sensitivity });
          break;
        case 'simplifyInteraction':
          recs.push({ action: 'simplify' });
          break;
        case 'showMotorShortcutRail':
          recs.push({
            action: 'motor_shortcut_rail',
            primaryTag: a.primaryTag,
            primaryText: a.primaryText,
            prioritizeNearby: a.prioritizeNearby !== false
          });
          break;
        default:
          break;
      }
    }
    return recs;
  }

  applyHermesRecommendations(element, recommendations) {
    const target = element && element.nodeType === 1 ? element : this.agenticFocusElement;

    recommendations.forEach(rec => {
      switch (rec.action) {
        case 'enlarge':
          if (target) this.enlargeElement(target, rec.scale || 1.5);
          break;
        case 'add_magnetic':
          if (target) this.addPermanentMagneticField(target, rec.strength || 80);
          break;
        case 'simplify':
          if (target) this.simplifyInteraction(target);
          break;
        case 'adjust_sensitivity':
          this.applySensitivity(rec.sensitivity);
          break;
        case 'motor_shortcut_rail':
          // Disabled motor rail - using AI sidebar instead
          // this.showMotorShortcutRail({ fromAgent: true, ...rec });
          break;
        default:
          break;
      }
    });

    const message =
      this.agentEscalation === true
        ? 'AI escalated assist: stronger snap, shortcuts, and targets.'
        : 'AI adapted the page and opened motor shortcuts.';
    this.showNotification(message);
    this.announceRail(message);
    this.postAssistMissStreak = 0;
    this.agentEscalation = false;
  }

  applySensitivity(factor) {
    if (typeof factor !== 'number' || Number.isNaN(factor)) return;
    this.settings.sensitivity = Math.min(1, Math.max(0.12, factor));
    document.documentElement.style.setProperty('--aa-sensitivity', String(this.settings.sensitivity));
  }

  announceRail(text) {
    if (!this.railLiveRegion) return;
    this.railLiveRegion.textContent = '';
    requestAnimationFrame(() => {
      this.railLiveRegion.textContent = text;
    });
  }

  showMotorShortcutRail(opts = {}) {
    if (!this.enabled) return;

    const width = 272;
    if (!this.motorRailEl) {
      const rail = document.createElement('aside');
      rail.id = 'aa-motor-shortcut-rail';
      rail.className = 'aa-motor-rail';
      rail.setAttribute('role', 'complementary');
      rail.setAttribute('aria-label', 'Adaptive motor shortcuts');
      rail.innerHTML = `
        <div class="aa-motor-rail__header">
          <span class="aa-motor-rail__title">Motor shortcuts</span>
          <button type="button" class="aa-motor-rail__collapse" aria-expanded="true" aria-label="Collapse shortcut rail">⟨</button>
        </div>
        <p class="aa-motor-rail__hint">Large targets and Alt+1–9 hotkeys when focus is on the page.</p>
        <div class="aa-motor-rail__live" aria-live="polite"></div>
        <div class="aa-motor-rail__actions"></div>
        <div class="aa-motor-rail__footer">
          <button type="button" class="aa-motor-rail__wide" data-aa-rail-action="top">Jump to top</button>
          <button type="button" class="aa-motor-rail__wide" data-aa-rail-action="scroll-up">Scroll up</button>
          <button type="button" class="aa-motor-rail__wide" data-aa-rail-action="scroll-down">Scroll down</button>
        </div>
      `;
      document.documentElement.appendChild(rail);
      this.motorRailEl = rail;
      this.railLiveRegion = rail.querySelector('.aa-motor-rail__live');

      rail.querySelector('.aa-motor-rail__collapse').addEventListener('click', () => {
        const collapsed = rail.classList.toggle('aa-motor-rail--collapsed');
        rail.querySelector('.aa-motor-rail__collapse').setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        document.documentElement.classList.toggle('aa-rail-layout--collapsed', collapsed);
      });

      rail.addEventListener('click', (ev) => {
        const btn = ev.target.closest('[data-aa-rail-action]');
        if (!btn) return;
        const act = btn.getAttribute('data-aa-rail-action');
        if (act === 'top') window.scrollTo({ top: 0, behavior: 'smooth' });
        if (act === 'scroll-up') window.scrollBy({ top: -Math.round(window.innerHeight * 0.85), behavior: 'smooth' });
        if (act === 'scroll-down') window.scrollBy({ top: Math.round(window.innerHeight * 0.85), behavior: 'smooth' });
      });

      document.addEventListener('keydown', this.onRailKeydownBound, true);
    }

    document.documentElement.classList.add('aa-rail-layout');
    document.documentElement.style.setProperty('--aa-rail-width', `${width}px`);
    this.motorRailVisible = true;
    this.populateMotorRail(opts);

    if (opts.announce) {
      this.announceRail(opts.announce);
    }
    if (opts.fromAgent) {
      this.announceRail('AI placed a shortcut rail for easier reaching. Use numbered buttons or Alt+digit.');
    }
  }

  hideMotorShortcutRail() {
    if (this.motorRailEl) {
      this.motorRailEl.remove();
      this.motorRailEl = null;
      this.railLiveRegion = null;
    }
    document.documentElement.classList.remove('aa-rail-layout', 'aa-rail-layout--collapsed');
    document.documentElement.style.removeProperty('--aa-rail-width');
    this.motorRailVisible = false;
    document.removeEventListener('keydown', this.onRailKeydownBound, true);
  }

  onRailHotkey(e) {
    if (!this.motorRailVisible || !this.enabled) return;
    if (!e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.repeat) return;

    let digit = null;
    const d = /^Digit([1-9])$/.exec(e.code || '');
    if (d) digit = parseInt(d[1], 10);
    else {
      const n = /^Numpad([1-9])$/.exec(e.code || '');
      if (n) digit = parseInt(n[1], 10);
    }
    if (digit == null) return;

    const idx = digit - 1;
    const buttons = this.motorRailEl?.querySelectorAll('.aa-motor-rail__chip');
    const btn = buttons?.[idx];
    const target = btn && this.motorRailChipTargets.get(btn);
    if (target) {
      e.preventDefault();
      this.activateShortcutTarget(target);
    }
  }

  collectMissCentroid() {
    const misses = this.metrics.missClicks;
    if (!misses.length) return null;
    const sx = misses.reduce((s, m) => s + m.x, 0);
    const sy = misses.reduce((s, m) => s + m.y, 0);
    return { x: sx / misses.length, y: sy / misses.length };
  }

  getMotorShortcutCandidates(opts = {}) {
    const centroid = this.collectMissCentroid();
    const prioritizeNearby = opts.prioritizeNearby !== false;
    const list = Array.from(this.clickableElements).filter(el => this.isVisible(el) && !this.motorRailEl?.contains(el));

    const scored = list.map(el => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dist =
        prioritizeNearby && centroid
          ? Math.hypot(cx - centroid.x, cy - centroid.y)
          : 0;
      const area = Math.max(1, rect.width * rect.height);
      const label = (el.getAttribute('aria-label') || el.textContent || el.value || el.title || '').trim();
      return { el, dist, area, label: label.slice(0, 56) || el.tagName.toLowerCase() };
    });

    scored.sort((a, b) => {
      if (prioritizeNearby && centroid) {
        const d = a.dist - b.dist;
        if (Math.abs(d) > 24) return d;
      }
      return b.area - a.area;
    });

    const out = [];
    const seen = new Set();
    for (const row of scored) {
      if (seen.has(row.el)) continue;
      seen.add(row.el);
      if (row.label.length < 2 && row.el.tagName === 'INPUT') {
        row.label = (row.el.getAttribute('placeholder') || row.el.type || 'input').slice(0, 56);
      }
      out.push(row);
      if (out.length >= 9) break;
    }
    return out;
  }

  populateMotorRail(opts = {}) {
    if (!this.motorRailEl) return;
    const host = this.motorRailEl.querySelector('.aa-motor-rail__actions');
    if (!host) return;
    host.innerHTML = '';
    const candidates = this.getMotorShortcutCandidates(opts);

    candidates.forEach((row, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'aa-motor-rail__chip';
      const num = i + 1;
      const hotkey = `Alt+${num}`;
      btn.innerHTML = `<span class="aa-motor-rail__kbd" aria-hidden="true">${num}</span><span class="aa-motor-rail__label">${this.escapeHtml(row.label)}</span><span class="aa-motor-rail__hintkey">${hotkey}</span>`;
      this.motorRailChipTargets.set(btn, row.el);
      btn.addEventListener('click', () => this.activateShortcutTarget(row.el));
      host.appendChild(btn);
    });
  }

  escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  getShortcutActivationElement(el) {
    const sel =
      'a, button:not([disabled]), input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [role="button"], [onclick]';
    if (el.matches(sel)) return el;
    const inner = el.querySelector(sel);
    return inner || el;
  }

  activateShortcutTarget(el) {
    if (!el || !el.isConnected) return;
    try {
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    } catch (_) {}

    const toActivate = this.getShortcutActivationElement(el);
    setTimeout(() => {
      if (!toActivate.isConnected) return;
      try {
        toActivate.click();
      } catch (_) {}
      if (toActivate.tagName !== 'A') {
        try {
          toActivate.focus({ preventScroll: true });
        } catch (_) {
          try {
            toActivate.focus();
          } catch (_) {}
        }
      }
      toActivate.classList.add('aa-rail-flash');
      setTimeout(() => toActivate.classList.remove('aa-rail-flash'), 1400);
    }, 280);
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

      case 'SHOW_SIDEBAR':
        this.createAISidebar();
        sendResponse({ success: true });
        break;

      case 'HIDE_SIDEBAR':
        this.removeSidebar();
        sendResponse({ success: true });
        break;

      case 'GET_STATUS':
        sendResponse({
          enabled: this.enabled,
          metrics: this.metrics,
          settings: this.settings
        });
        break;

      case 'AUTO_ASSISTANCE':
        this.interventionGeneration++;
        this.applyHermesRecommendations(this.agenticFocusElement, message.recommendations || []);
        sendResponse({ success: true });
        break;

      case 'HERMES_RESPONSE': {
        const recs = this.hermesFunctionsToRecommendations(message.data?.functions);
        if (recs.length) {
          this.interventionGeneration++;
          this.applyHermesRecommendations(this.agenticFocusElement, recs);
        }
        sendResponse({ success: true });
        break;
      }
    }
  }

  enable() {
    this.enabled = true;
    document.body.classList.add('aa-enabled');
    chrome.storage.local.set({ enabled: true });
    this.showNotification('Adaptive Access AI enabled');

    // Initial scan
    this.scanForClickableElements();

    // Create AI sidebar if enabled in settings
    if (this.settings.showAISidebar !== false) {
      this.createAISidebar();
    }
  }

  disable() {
    this.enabled = false;
    document.body.classList.remove('aa-enabled');
    chrome.storage.local.set({ enabled: false });
    this.showNotification('Adaptive Access AI disabled');

    // Cleanup
    this.cleanupEnhancements();

    // Remove AI sidebar
    this.removeSidebar();
  }

  toggle() {
    if (this.enabled) {
      this.disable();
    } else {
      this.enable();
    }
  }

  cleanupEnhancements() {
    this.hideMotorShortcutRail();  // Clean up any existing motor rail
    this.agentSessionForWindow = false;
    this.interventionGeneration = 0;
    this.agenticFocusElement = null;

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

  // AI Sidebar functionality
  createAISidebar() {
    // Check if sidebar already exists
    if (document.getElementById('aa-ai-sidebar')) return;

    const sidebar = document.createElement('aside');
    sidebar.id = 'aa-ai-sidebar';
    sidebar.className = 'modern-ai-sidebar';
    sidebar.setAttribute('role', 'complementary');
    sidebar.setAttribute('aria-label', 'AI Control Summary');

    sidebar.innerHTML = `
      <div class="sidebar-header">
        <h3 class="sidebar-title">AI Control Summary</h3>
        <p class="sidebar-subtitle">Smart interface analysis</p>
        <button type="button" class="sidebar-toggle" aria-label="Toggle sidebar">→</button>
      </div>
      <div class="sidebar-content">
        <div class="loading-dots">
          <span class="loading-dot"></span>
          <span class="loading-dot"></span>
          <span class="loading-dot"></span>
        </div>
        <div class="sidebar-controls"></div>
      </div>
      <div class="sidebar-footer">
        <button type="button" class="refresh-button" aria-label="Refresh analysis">
          <span>↻</span>
          <span>Refresh Analysis</span>
        </button>
      </div>
    `;

    document.body.appendChild(sidebar);

    // Add event listeners
    sidebar.querySelector('.sidebar-toggle').addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      const toggle = sidebar.querySelector('.sidebar-toggle');
      toggle.textContent = sidebar.classList.contains('collapsed') ? '←' : '→';
    });

    sidebar.querySelector('.refresh-button').addEventListener('click', () => {
      this.analyzePageControls();
    });

    // Inject modern CSS styles
    if (!document.getElementById('modern-ui-styles')) {
      const link = document.createElement('link');
      link.id = 'modern-ui-styles';
      link.rel = 'stylesheet';
      link.href = chrome.runtime.getURL('css/modern-ui.css');
      document.head.appendChild(link);
    }

    // No longer need old styles - modern-ui.css handles everything
    document.body.classList.add('modern-ai-sidebar-active');

    // Start analysis
    this.analyzePageControls();
  }

  analyzePageControls() {
    const sidebar = document.getElementById('aa-ai-sidebar');
    if (!sidebar) return;

    const controlsContainer = sidebar.querySelector('.sidebar-controls');
    const loadingIndicator = sidebar.querySelector('.loading-dots');

    // Show loading
    loadingIndicator.style.display = 'block';
    controlsContainer.innerHTML = '';

    // Find all interactive elements
    const buttons = Array.from(document.querySelectorAll('button:not(.aa-ai-sidebar button):not(.aa-ai-sidebar__toggle):not(.aa-ai-sidebar__refresh):not(.aa-motor-rail button)'));
    const links = Array.from(document.querySelectorAll('a[href]:not(.aa-ai-sidebar a)'));
    const inputs = Array.from(document.querySelectorAll('input:not(.aa-ai-sidebar input)'));
    const selects = Array.from(document.querySelectorAll('select:not(.aa-ai-sidebar select)'));
    const sliders = Array.from(document.querySelectorAll('input[type="range"]:not(.aa-ai-sidebar input)'));

    // Group and summarize controls
    const controlGroups = [];

    // Process buttons
    if (buttons.length > 0) {
      const buttonGroup = {
        title: 'Buttons',
        items: buttons.slice(0, 10).map(btn => ({
          element: btn,
          text: this.getElementText(btn),
          description: this.generateElementDescription(btn)
        }))
      };
      controlGroups.push(buttonGroup);
    }

    // Process important links
    const importantLinks = links.filter(link => {
      const text = this.getElementText(link).toLowerCase();
      return text && (
        text.includes('submit') ||
        text.includes('continue') ||
        text.includes('next') ||
        text.includes('sign') ||
        text.includes('log') ||
        text.includes('buy') ||
        text.includes('add to cart')
      );
    });

    if (importantLinks.length > 0) {
      const linkGroup = {
        title: 'Important Actions',
        items: importantLinks.slice(0, 5).map(link => ({
          element: link,
          text: this.getElementText(link),
          description: `Link to: ${link.href.substring(0, 50)}...`
        }))
      };
      controlGroups.push(linkGroup);
    }

    // Process sliders
    if (sliders.length > 0) {
      const sliderGroup = {
        title: 'Sliders',
        items: sliders.slice(0, 5).map(slider => ({
          element: slider,
          text: slider.getAttribute('aria-label') || slider.name || 'Slider',
          description: `Range: ${slider.min || 0} to ${slider.max || 100}, Current: ${slider.value}`,
          isSlider: true,
          min: slider.min || 0,
          max: slider.max || 100,
          value: slider.value
        }))
      };
      controlGroups.push(sliderGroup);
    }

    // Process form inputs
    const formInputs = inputs.filter(input =>
      input.type !== 'hidden' &&
      input.type !== 'range' &&
      (input.type === 'submit' || input.type === 'button' || input.type === 'checkbox' || input.type === 'radio')
    );

    if (formInputs.length > 0) {
      const inputGroup = {
        title: 'Form Controls',
        items: formInputs.slice(0, 5).map(input => ({
          element: input,
          text: input.value || input.placeholder || input.name || input.type,
          description: `${input.type} control`
        }))
      };
      controlGroups.push(inputGroup);
    }

    // Hide loading and render controls
    loadingIndicator.style.display = 'none';

    if (controlGroups.length === 0) {
      controlsContainer.innerHTML = '<div class="loading-dots">No interactive controls found on this page.</div>';
      return;
    }

    // Render control groups
    controlGroups.forEach(group => {
      const groupEl = document.createElement('div');
      groupEl.className = 'control-group';

      const titleEl = document.createElement('div');
      titleEl.className = 'control-group-title';
      titleEl.textContent = group.title;
      groupEl.appendChild(titleEl);

      group.items.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = 'control-card';

        if (item.isSlider) {
          // Create slider control
          const sliderContainer = document.createElement('div');
          sliderContainer.className = 'aa-ai-sidebar__control-slider';

          const slider = document.createElement('input');
          slider.type = 'range';
          slider.min = item.min;
          slider.max = item.max;
          slider.value = item.value;

          const valueDisplay = document.createElement('span');
          valueDisplay.className = 'aa-ai-sidebar__control-value';
          valueDisplay.textContent = item.value;

          slider.addEventListener('input', (e) => {
            valueDisplay.textContent = e.target.value;
            // Update the original slider
            item.element.value = e.target.value;
            item.element.dispatchEvent(new Event('input', { bubbles: true }));
            item.element.dispatchEvent(new Event('change', { bubbles: true }));
          });

          const label = document.createElement('div');
          label.style.fontSize = '13px';
          label.style.marginBottom = '8px';
          label.textContent = item.text;

          itemEl.appendChild(label);
          sliderContainer.appendChild(slider);
          sliderContainer.appendChild(valueDisplay);
          itemEl.appendChild(sliderContainer);

          const desc = document.createElement('div');
          desc.className = 'aa-ai-sidebar__control-desc';
          desc.textContent = item.description;
          itemEl.appendChild(desc);
        } else {
          // Create button control
          const btn = document.createElement('button');
          btn.className = 'control-button';
          btn.textContent = item.text || 'Unnamed Control';

          btn.addEventListener('click', () => {
            // Trigger the original element
            if (item.element.tagName === 'A') {
              item.element.click();
            } else {
              item.element.click();
              item.element.focus();
            }
          });

          itemEl.appendChild(btn);

          if (item.description) {
            const desc = document.createElement('div');
            desc.className = 'control-description';
            desc.textContent = item.description;
            itemEl.appendChild(desc);
          }
        }

        groupEl.appendChild(itemEl);
      });

      controlsContainer.appendChild(groupEl);
    });
  }

  getElementText(element) {
    // Try to get meaningful text from element
    return element.textContent?.trim() ||
           element.value ||
           element.getAttribute('aria-label') ||
           element.getAttribute('title') ||
           element.getAttribute('alt') ||
           element.getAttribute('name') ||
           '';
  }

  generateElementDescription(element) {
    // Generate AI-like description based on element attributes
    const role = element.getAttribute('role');
    const ariaLabel = element.getAttribute('aria-label');
    const title = element.getAttribute('title');
    const type = element.type;
    const className = element.className;

    if (ariaLabel) return `Accessible: ${ariaLabel}`;
    if (title) return `Tooltip: ${title}`;
    if (role) return `Role: ${role}`;
    if (type) return `Type: ${type}`;
    if (className && className.includes('submit')) return 'Submits form';
    if (className && className.includes('cancel')) return 'Cancels action';

    return 'Interactive element';
  }

  removeSidebar() {
    const sidebar = document.getElementById('aa-ai-sidebar');
    if (sidebar) {
      sidebar.remove();
      document.body.classList.remove('modern-ai-sidebar-active', 'collapsed');
    }

    const styles = document.getElementById('modern-ui-styles');
    if (styles) {
      styles.remove();
    }
  }
}

// Initialize
const adaptiveAI = new AdaptiveAccessAI();