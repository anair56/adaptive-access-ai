// Voice-Controlled Web Navigator for TremorSense
// Natural language commands for hands-free web browsing

class VoiceNavigator {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.commandHistory = [];
    this.feedbackElement = null;
    this.confidenceThreshold = 0.7;
    this.enabled = false;
    this.continuousMode = false;

    // Voice command patterns
    this.commandPatterns = {
      // Navigation commands
      click: /(?:click|tap|press|select|choose|hit)(?: on| the)?\s+(.+)/i,
      doubleClick: /(?:double click|double tap)(?: on| the)?\s+(.+)/i,
      rightClick: /(?:right click|context menu)(?: on| the)?\s+(.+)/i,

      // Form commands
      type: /(?:type|write|enter|input)\s+(.+)/i,
      fill: /(?:fill|complete)(?: the)?\s+(.+?)\s+(?:with|as)\s+(.+)/i,
      clear: /(?:clear|empty|delete)(?: the)?\s+(.+)/i,

      // Scrolling commands
      scrollDown: /scroll\s+(?:down|lower)/i,
      scrollUp: /scroll\s+(?:up|higher)/i,
      scrollTo: /scroll\s+to\s+(.+)/i,

      // Navigation
      back: /(?:go\s+)?back|previous\s+page/i,
      forward: /(?:go\s+)?forward|next\s+page/i,
      refresh: /refresh|reload/i,
      home: /(?:go\s+)?home/i,

      // Tab commands
      newTab: /(?:open\s+)?new\s+tab/i,
      closeTab: /close\s+(?:this\s+)?tab/i,
      nextTab: /next\s+tab/i,
      previousTab: /previous\s+tab/i,

      // Special commands
      help: /(?:show\s+)?help|commands|what\s+can\s+(?:you|i)\s+(?:do|say)/i,
      stop: /stop\s+(?:listening|voice)/i,
      start: /start\s+(?:listening|voice)/i,

      // Smart selections
      button: /(?:find|show|highlight)\s+(?:all\s+)?buttons/i,
      link: /(?:find|show|highlight)\s+(?:all\s+)?links/i,
      form: /(?:find|show|highlight)\s+(?:all\s+)?forms/i,

      // Numbered elements
      number: /(?:click|select)\s+(?:number|item)\s+(\d+)/i,

      // Color/position based
      colorClick: /click\s+(?:the\s+)?(\w+)\s+(?:button|link|element)/i,
      positionClick: /click\s+(?:at\s+)?(?:the\s+)?(top|bottom|left|right|center)/i,

      // Focus commands
      focus: /focus\s+(?:on\s+)?(.+)/i,
      next: /(?:next|tab)/i,
      previous: /(?:previous|shift\s+tab)/i,

      // Submit/Cancel
      submit: /submit|send|confirm/i,
      cancel: /cancel|close|escape/i,

      // Read commands
      read: /read\s+(?:the\s+)?(.+)/i,
      readAll: /read\s+(?:everything|all|page)/i
    };

    this.init();
  }

  init() {
    // Check for browser support
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.warn('Voice Navigator: Speech recognition not supported');
      return;
    }

    // Initialize speech recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'en-US';
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 3;

    this.setupEventHandlers();
    this.createUI();
  }

  setupEventHandlers() {
    if (!this.recognition) return;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.updateUI('Listening...', 'listening');
      this.showVisualFeedback('🎤 Listening...');
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.updateUI('Voice control ready', 'ready');

      // Auto-restart in continuous mode
      if (this.continuousMode && this.enabled) {
        setTimeout(() => this.start(), 100);
      }
    };

    this.recognition.onerror = (event) => {
      console.error('Voice Navigator error:', event.error);
      this.updateUI(`Error: ${event.error}`, 'error');

      if (event.error === 'no-speech') {
        this.showVisualFeedback('No speech detected. Try again.');
      }
    };

    this.recognition.onresult = (event) => {
      const results = event.results[event.results.length - 1];
      const transcript = results[0].transcript.trim().toLowerCase();
      const confidence = results[0].confidence;

      // Show interim results
      if (results.isFinal) {
        this.processCommand(transcript, confidence);
      } else {
        this.updateUI(`Hearing: "${transcript}"`, 'processing');
      }
    };

    // Keyboard shortcut for voice control (Cmd+Shift+V on Mac, Ctrl+Shift+V on Windows)
    document.addEventListener('keydown', (e) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifierKey = isMac ? e.metaKey : e.ctrlKey;

      if (modifierKey && e.shiftKey && e.key === 'V') {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  processCommand(transcript, confidence) {
    console.log(`Voice command: "${transcript}" (confidence: ${confidence})`);
    this.commandHistory.push({ transcript, confidence, timestamp: Date.now() });

    // Check confidence threshold
    if (confidence < this.confidenceThreshold && confidence !== undefined) {
      this.showVisualFeedback(`Not sure I heard that correctly. Please try again.`);
      return;
    }

    // Try to match command patterns
    let commandExecuted = false;

    for (const [command, pattern] of Object.entries(this.commandPatterns)) {
      const match = transcript.match(pattern);
      if (match) {
        commandExecuted = true;
        this.executeCommand(command, match, transcript);
        break;
      }
    }

    if (!commandExecuted) {
      // Try fuzzy matching for common elements
      this.handleFuzzyCommand(transcript);
    }
  }

  executeCommand(command, match, fullTranscript) {
    switch (command) {
      case 'click':
        this.clickElement(match[1]);
        break;

      case 'doubleClick':
        this.doubleClickElement(match[1]);
        break;

      case 'type':
        this.typeText(match[1]);
        break;

      case 'fill':
        this.fillField(match[1], match[2]);
        break;

      case 'scrollDown':
        this.scroll('down');
        break;

      case 'scrollUp':
        this.scroll('up');
        break;

      case 'scrollTo':
        this.scrollToElement(match[1]);
        break;

      case 'back':
        window.history.back();
        this.showVisualFeedback('Going back');
        break;

      case 'forward':
        window.history.forward();
        this.showVisualFeedback('Going forward');
        break;

      case 'refresh':
        window.location.reload();
        this.showVisualFeedback('Refreshing page');
        break;

      case 'help':
        this.showHelp();
        break;

      case 'stop':
        this.stop();
        break;

      case 'button':
        this.highlightElements('button');
        break;

      case 'link':
        this.highlightElements('a');
        break;

      case 'number':
        this.clickNumberedElement(parseInt(match[1]));
        break;

      case 'colorClick':
        this.clickByColor(match[1]);
        break;

      case 'positionClick':
        this.clickByPosition(match[1]);
        break;

      case 'focus':
        this.focusElement(match[1]);
        break;

      case 'next':
        this.tabForward();
        break;

      case 'previous':
        this.tabBackward();
        break;

      case 'submit':
        this.submitForm();
        break;

      case 'cancel':
        this.cancelOrClose();
        break;

      case 'read':
        this.readElement(match[1]);
        break;

      case 'readAll':
        this.readPage();
        break;

      default:
        this.showVisualFeedback(`Command recognized but not implemented: ${command}`);
    }
  }

  clickElement(descriptor) {
    const element = this.findElementByDescription(descriptor);
    if (element) {
      this.simulateClick(element);
      this.showVisualFeedback(`Clicked: ${descriptor}`);
    } else {
      this.showVisualFeedback(`Can't find: ${descriptor}. Try being more specific.`);
      this.suggestAlternatives(descriptor);
    }
  }

  doubleClickElement(descriptor) {
    const element = this.findElementByDescription(descriptor);
    if (element) {
      this.simulateDoubleClick(element);
      this.showVisualFeedback(`Double-clicked: ${descriptor}`);
    }
  }

  findElementByDescription(descriptor) {
    // Clean up the descriptor
    descriptor = descriptor.trim().toLowerCase();

    // Strategy 1: Direct text content match
    let elements = Array.from(document.querySelectorAll('button, a, input, select, textarea, [role="button"], [onclick]'));

    // Try exact match first
    let found = elements.find(el => {
      const text = (el.textContent || el.value || el.placeholder || '').trim().toLowerCase();
      const label = el.getAttribute('aria-label')?.toLowerCase() || '';
      const title = el.getAttribute('title')?.toLowerCase() || '';
      const alt = el.getAttribute('alt')?.toLowerCase() || '';

      return text === descriptor || label === descriptor || title === descriptor || alt === descriptor;
    });

    // Try partial match
    if (!found) {
      found = elements.find(el => {
        const text = (el.textContent || el.value || el.placeholder || '').trim().toLowerCase();
        const label = el.getAttribute('aria-label')?.toLowerCase() || '';
        const title = el.getAttribute('title')?.toLowerCase() || '';

        return text.includes(descriptor) || label.includes(descriptor) ||
               title.includes(descriptor) || descriptor.includes(text);
      });
    }

    // Try by class or ID
    if (!found) {
      found = document.getElementById(descriptor) ||
              document.querySelector(`.${descriptor}`) ||
              document.querySelector(`[name="${descriptor}"]`);
    }

    // Try by common button types
    if (!found && descriptor.includes('submit')) {
      found = document.querySelector('button[type="submit"], input[type="submit"]');
    }

    if (!found && descriptor.includes('search')) {
      found = document.querySelector('input[type="search"], input[placeholder*="search" i]');
    }

    return found;
  }

  simulateClick(element) {
    // Scroll into view
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Highlight element
    const originalStyle = element.style.cssText;
    element.style.cssText += 'outline: 3px solid #00ff88 !important; outline-offset: 2px !important;';

    setTimeout(() => {
      // Simulate click
      const clickEvent = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true
      });
      element.dispatchEvent(clickEvent);

      // Restore style
      setTimeout(() => {
        element.style.cssText = originalStyle;
      }, 500);
    }, 300);
  }

  simulateDoubleClick(element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const dblClickEvent = new MouseEvent('dblclick', {
      view: window,
      bubbles: true,
      cancelable: true
    });
    element.dispatchEvent(dblClickEvent);
  }

  typeText(text) {
    const activeElement = document.activeElement;
    if (activeElement && (activeElement.tagName === 'INPUT' ||
                          activeElement.tagName === 'TEXTAREA' ||
                          activeElement.contentEditable === 'true')) {

      // Clear existing text if needed
      if (activeElement.value !== undefined) {
        activeElement.value = text;
      } else {
        activeElement.textContent = text;
      }

      // Trigger input event
      activeElement.dispatchEvent(new Event('input', { bubbles: true }));
      activeElement.dispatchEvent(new Event('change', { bubbles: true }));

      this.showVisualFeedback(`Typed: "${text}"`);
    } else {
      this.showVisualFeedback('Please focus on a text field first');
    }
  }

  fillField(fieldDescriptor, value) {
    const field = this.findElementByDescription(fieldDescriptor);
    if (field) {
      field.focus();
      field.value = value;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
      this.showVisualFeedback(`Filled ${fieldDescriptor} with "${value}"`);
    }
  }

  scroll(direction) {
    const scrollAmount = direction === 'down' ? 300 : -300;
    window.scrollBy({ top: scrollAmount, behavior: 'smooth' });
    this.showVisualFeedback(`Scrolling ${direction}`);
  }

  scrollToElement(descriptor) {
    const element = this.findElementByDescription(descriptor);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      this.showVisualFeedback(`Scrolled to ${descriptor}`);
    }
  }

  highlightElements(selector) {
    const elements = document.querySelectorAll(selector);
    const numbers = [];

    elements.forEach((el, index) => {
      const number = document.createElement('div');
      number.textContent = (index + 1).toString();
      number.style.cssText = `
        position: absolute;
        background: #00ff88;
        color: black;
        padding: 4px 8px;
        border-radius: 4px;
        font-weight: bold;
        z-index: 10000;
        pointer-events: none;
      `;

      const rect = el.getBoundingClientRect();
      number.style.left = `${rect.left - 30}px`;
      number.style.top = `${rect.top + window.scrollY}px`;

      document.body.appendChild(number);
      numbers.push(number);

      el.setAttribute('data-voice-number', index + 1);
    });

    this.showVisualFeedback(`Found ${elements.length} ${selector}s. Say "click number X" to select.`);

    // Remove numbers after 5 seconds
    setTimeout(() => {
      numbers.forEach(n => n.remove());
    }, 5000);
  }

  clickNumberedElement(number) {
    const element = document.querySelector(`[data-voice-number="${number}"]`);
    if (element) {
      this.simulateClick(element);
      this.showVisualFeedback(`Clicked element #${number}`);
    }
  }

  clickByColor(color) {
    const elements = Array.from(document.querySelectorAll('button, a, [role="button"]'));
    const found = elements.find(el => {
      const computedStyle = window.getComputedStyle(el);
      const bgColor = computedStyle.backgroundColor.toLowerCase();
      const textColor = computedStyle.color.toLowerCase();

      return bgColor.includes(color) || textColor.includes(color) ||
             el.className.toLowerCase().includes(color);
    });

    if (found) {
      this.simulateClick(found);
      this.showVisualFeedback(`Clicked ${color} element`);
    }
  }

  clickByPosition(position) {
    const elements = Array.from(document.querySelectorAll('button, a, [role="button"]'));
    let target;

    switch (position) {
      case 'top':
        target = elements.reduce((top, el) => {
          const rect = el.getBoundingClientRect();
          const topRect = top?.getBoundingClientRect();
          return !topRect || rect.top < topRect.top ? el : top;
        }, null);
        break;

      case 'bottom':
        target = elements.reduce((bottom, el) => {
          const rect = el.getBoundingClientRect();
          const bottomRect = bottom?.getBoundingClientRect();
          return !bottomRect || rect.bottom > bottomRect.bottom ? el : bottom;
        }, null);
        break;

      case 'left':
        target = elements.reduce((left, el) => {
          const rect = el.getBoundingClientRect();
          const leftRect = left?.getBoundingClientRect();
          return !leftRect || rect.left < leftRect.left ? el : left;
        }, null);
        break;

      case 'right':
        target = elements.reduce((right, el) => {
          const rect = el.getBoundingClientRect();
          const rightRect = right?.getBoundingClientRect();
          return !rightRect || rect.right > rightRect.right ? el : right;
        }, null);
        break;

      case 'center':
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        target = elements.reduce((closest, el) => {
          const rect = el.getBoundingClientRect();
          const elCenterX = rect.left + rect.width / 2;
          const elCenterY = rect.top + rect.height / 2;
          const distance = Math.hypot(elCenterX - centerX, elCenterY - centerY);

          const closestRect = closest?.getBoundingClientRect();
          if (!closestRect) return el;

          const closestCenterX = closestRect.left + closestRect.width / 2;
          const closestCenterY = closestRect.top + closestRect.height / 2;
          const closestDistance = Math.hypot(closestCenterX - centerX, closestCenterY - centerY);

          return distance < closestDistance ? el : closest;
        }, null);
        break;
    }

    if (target) {
      this.simulateClick(target);
      this.showVisualFeedback(`Clicked ${position} element`);
    }
  }

  focusElement(descriptor) {
    const element = this.findElementByDescription(descriptor);
    if (element) {
      element.focus();
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      this.showVisualFeedback(`Focused on ${descriptor}`);
    }
  }

  tabForward() {
    const event = new KeyboardEvent('keydown', {
      key: 'Tab',
      code: 'Tab',
      keyCode: 9,
      which: 9,
      bubbles: true
    });
    document.activeElement.dispatchEvent(event);
    this.showVisualFeedback('Moved to next field');
  }

  tabBackward() {
    const event = new KeyboardEvent('keydown', {
      key: 'Tab',
      code: 'Tab',
      keyCode: 9,
      which: 9,
      shiftKey: true,
      bubbles: true
    });
    document.activeElement.dispatchEvent(event);
    this.showVisualFeedback('Moved to previous field');
  }

  submitForm() {
    const form = document.querySelector('form');
    const submitBtn = document.querySelector('button[type="submit"], input[type="submit"]');

    if (submitBtn) {
      this.simulateClick(submitBtn);
    } else if (form) {
      form.submit();
      this.showVisualFeedback('Form submitted');
    }
  }

  cancelOrClose() {
    // Look for cancel/close buttons
    const cancelBtn = this.findElementByDescription('cancel') ||
                     this.findElementByDescription('close') ||
                     this.findElementByDescription('x');

    if (cancelBtn) {
      this.simulateClick(cancelBtn);
    } else {
      // Send escape key
      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        keyCode: 27,
        which: 27,
        bubbles: true
      });
      document.dispatchEvent(event);
      this.showVisualFeedback('Cancelled');
    }
  }

  readElement(descriptor) {
    const element = this.findElementByDescription(descriptor);
    if (element) {
      const text = element.textContent || element.value || 'No text content';
      this.speak(text);
      this.showVisualFeedback(`Reading: ${descriptor}`);
    }
  }

  readPage() {
    const mainContent = document.querySelector('main') || document.querySelector('article') || document.body;
    const text = mainContent.textContent.substring(0, 500); // Limit for demo
    this.speak(text);
    this.showVisualFeedback('Reading page content');
  }

  speak(text) {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      speechSynthesis.speak(utterance);
    }
  }

  handleFuzzyCommand(transcript) {
    // Try to be smart about common variations
    if (transcript.includes('click') || transcript.includes('press')) {
      const words = transcript.split(' ');
      const targetWords = words.slice(words.indexOf('click') + 1).join(' ');
      this.clickElement(targetWords);
    } else if (transcript.includes('scroll')) {
      if (transcript.includes('down') || transcript.includes('bottom')) {
        this.scroll('down');
      } else if (transcript.includes('up') || transcript.includes('top')) {
        this.scroll('up');
      }
    } else if (transcript.includes('type') || transcript.includes('write')) {
      const words = transcript.split(' ');
      const textToType = words.slice(1).join(' ');
      this.typeText(textToType);
    } else {
      this.showVisualFeedback(`Didn't understand: "${transcript}". Say "help" for commands.`);
    }
  }

  suggestAlternatives(descriptor) {
    const elements = Array.from(document.querySelectorAll('button, a, input, select, textarea'));
    const suggestions = elements
      .filter(el => {
        const text = (el.textContent || el.value || '').trim().toLowerCase();
        return text.length > 0 && text.includes(descriptor.substring(0, 3));
      })
      .slice(0, 3)
      .map(el => el.textContent || el.value)
      .filter(Boolean);

    if (suggestions.length > 0) {
      this.showVisualFeedback(`Did you mean: ${suggestions.join(', ')}?`);
    }
  }

  showHelp() {
    const helpText = `
      🎤 Voice Commands Available:

      CLICKING:
      • "Click [button name]" - Click any button or link
      • "Double click [element]" - Double click element
      • "Right click [element]" - Open context menu

      NAVIGATION:
      • "Scroll down/up" - Scroll the page
      • "Go back/forward" - Browser navigation
      • "Refresh" - Reload the page

      TEXT INPUT:
      • "Type [your text]" - Type in focused field
      • "Fill [field name] with [text]" - Fill specific field
      • "Clear [field]" - Clear a field

      SMART COMMANDS:
      • "Show all buttons/links" - Number all elements
      • "Click number [X]" - Click numbered element
      • "Submit" - Submit the form
      • "Cancel/Close" - Close dialog or cancel

      FOCUS:
      • "Focus [element]" - Focus on element
      • "Next/Tab" - Move to next field
      • "Previous" - Move to previous field

      READING:
      • "Read [element]" - Read element text aloud
      • "Read page" - Read page content

      Say "Stop voice" to disable
    `;

    this.showVisualFeedback(helpText, 10000);
  }

  createUI() {
    // Voice control button
    const voiceButton = document.createElement('button');
    voiceButton.id = 'tremor-sense-voice-btn';
    voiceButton.innerHTML = '🎤';
    voiceButton.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      font-size: 24px;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
      z-index: 10001;
      transition: all 0.3s ease;
    `;

    voiceButton.addEventListener('click', () => this.toggle());
    document.body.appendChild(voiceButton);

    // Status indicator
    const statusIndicator = document.createElement('div');
    statusIndicator.id = 'tremor-sense-voice-status';
    statusIndicator.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 14px;
      z-index: 10001;
      display: none;
      max-width: 300px;
    `;
    document.body.appendChild(statusIndicator);

    this.voiceButton = voiceButton;
    this.statusIndicator = statusIndicator;
  }

  updateUI(message, state) {
    if (this.statusIndicator) {
      this.statusIndicator.textContent = message;
      this.statusIndicator.style.display = 'block';

      // Update color based on state
      switch (state) {
        case 'listening':
          this.statusIndicator.style.background = 'linear-gradient(135deg, #00ff88 0%, #00cc70 100%)';
          this.voiceButton.style.background = 'linear-gradient(135deg, #00ff88 0%, #00cc70 100%)';
          break;
        case 'processing':
          this.statusIndicator.style.background = 'linear-gradient(135deg, #ff9500 0%, #ff7000 100%)';
          break;
        case 'error':
          this.statusIndicator.style.background = 'linear-gradient(135deg, #ff4444 0%, #cc0000 100%)';
          break;
        default:
          this.statusIndicator.style.background = 'rgba(0, 0, 0, 0.9)';
          this.voiceButton.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
      }

      // Auto-hide after 3 seconds (except when listening)
      if (state !== 'listening') {
        setTimeout(() => {
          this.statusIndicator.style.display = 'none';
        }, 3000);
      }
    }
  }

  showVisualFeedback(message, duration = 3000) {
    if (!this.feedbackElement) {
      this.feedbackElement = document.createElement('div');
      this.feedbackElement.style.cssText = `
        position: fixed;
        bottom: 100px;
        left: 50%;
        transform: translateX(-50%);
        padding: 16px 24px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border-radius: 12px;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        font-size: 14px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        z-index: 10002;
        max-width: 400px;
        text-align: center;
        white-space: pre-line;
        animation: slideUp 0.3s ease;
      `;
      document.body.appendChild(this.feedbackElement);

      // Add animation
      const style = document.createElement('style');
      style.textContent = `
        @keyframes slideUp {
          from {
            transform: translateX(-50%) translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
          }
        }
      `;
      document.head.appendChild(style);
    }

    this.feedbackElement.textContent = message;
    this.feedbackElement.style.display = 'block';

    clearTimeout(this.feedbackTimeout);
    this.feedbackTimeout = setTimeout(() => {
      if (this.feedbackElement) {
        this.feedbackElement.style.display = 'none';
      }
    }, duration);
  }

  async start() {
    if (this.recognition && !this.isListening) {
      try {
        // Check if we have microphone permissions
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
          .catch(err => {
            console.log('Microphone permission needed:', err);
            this.showPermissionPrompt();
            return null;
          });

        if (stream) {
          // We have permission, stop the stream and start recognition
          stream.getTracks().forEach(track => track.stop());
          this.recognition.start();
          this.enabled = true;
        }
      } catch (error) {
        console.error('Voice Navigator: Failed to start', error);
        this.showPermissionPrompt();
      }
    }
  }

  showPermissionPrompt() {
    const prompt = document.createElement('div');
    prompt.id = 'voice-permission-prompt';
    prompt.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      color: black;
      padding: 30px;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      z-index: 2147483647;
      max-width: 400px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      text-align: center;
    `;

    prompt.innerHTML = `
      <h2 style="margin: 0 0 15px 0; color: #333;">🎤 Enable Voice Control</h2>
      <p style="margin: 0 0 20px 0; color: #666; line-height: 1.5;">
        TremorSense needs microphone access to enable voice commands.
        Click below and allow microphone access when prompted by your browser.
      </p>
      <button id="grant-mic-permission" style="
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        padding: 12px 30px;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        margin-right: 10px;
      ">Grant Microphone Access</button>
      <button id="cancel-mic-permission" style="
        background: #f0f0f0;
        color: #666;
        border: none;
        padding: 12px 30px;
        border-radius: 8px;
        font-size: 16px;
        cursor: pointer;
      ">Cancel</button>
    `;

    document.body.appendChild(prompt);

    document.getElementById('grant-mic-permission').addEventListener('click', async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        prompt.remove();
        this.showVisualFeedback('✅ Microphone access granted! Voice control is ready.');
        this.recognition.start();
        this.enabled = true;
      } catch (error) {
        prompt.innerHTML += `<p style="color: red; margin-top: 10px;">
          ⚠️ Permission denied. Please check your browser settings and try again.
        </p>`;
      }
    });

    document.getElementById('cancel-mic-permission').addEventListener('click', () => {
      prompt.remove();
      this.showVisualFeedback('Voice control cancelled');
    });
  }

  stop() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.enabled = false;
      this.continuousMode = false;
      this.showVisualFeedback('Voice control stopped');
    }
  }

  async toggle() {
    if (this.isListening) {
      this.stop();
    } else {
      await this.start();
      if (this.enabled) {
        this.showVisualFeedback('Voice control activated! Say "help" for commands.');
      }
    }
  }

  setContinuousMode(enabled) {
    this.continuousMode = enabled;
    if (enabled) {
      this.showVisualFeedback('Continuous listening mode enabled');
    }
  }

  destroy() {
    if (this.recognition) {
      this.recognition.stop();
      this.recognition = null;
    }

    if (this.voiceButton) {
      this.voiceButton.remove();
    }

    if (this.statusIndicator) {
      this.statusIndicator.remove();
    }

    if (this.feedbackElement) {
      this.feedbackElement.remove();
    }
  }
}

// Export for use in content.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VoiceNavigator;
}