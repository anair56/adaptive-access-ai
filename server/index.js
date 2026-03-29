const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const HERMES_API_KEY = process.env.HERMES_API_KEY || 'demo-key';
const HERMES_API_URL = 'https://api.nousresearch.com/v1/chat/completions';

// Hermes function definitions for accessibility
const hermesFunctions = [
  {
    name: 'adjustCursorSensitivity',
    description: 'Adjust mouse cursor sensitivity based on proximity to targets',
    parameters: {
      type: 'object',
      properties: {
        sensitivity: { type: 'number', description: 'Sensitivity factor (0.1-1.0)' },
        radius: { type: 'number', description: 'Effect radius in pixels' }
      },
      required: ['sensitivity']
    }
  },
  {
    name: 'enlargeClickTarget',
    description: 'Increase the clickable area of UI elements',
    parameters: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector for target element' },
        scale: { type: 'number', description: 'Scale factor (1.0-3.0)' }
      },
      required: ['selector', 'scale']
    }
  },
  {
    name: 'addMagneticSnap',
    description: 'Add magnetic snapping to help cursor reach targets',
    parameters: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector for target' },
        strength: { type: 'number', description: 'Magnetic pull strength (0-100)' }
      },
      required: ['selector', 'strength']
    }
  },
  {
    name: 'detectAccessibilityNeed',
    description: 'Analyze user behavior to detect accessibility requirements',
    parameters: {
      type: 'object',
      properties: {
        missClicks: { type: 'array', items: { type: 'object' } },
        timeToClick: { type: 'number' },
        tremorFrequency: { type: 'number' }
      }
    }
  },
  {
    name: 'simplifyInteraction',
    description: 'Convert complex interactions to simpler ones',
    parameters: {
      type: 'object',
      properties: {
        originalAction: { type: 'string' },
        simplifiedAction: { type: 'string' }
      },
      required: ['originalAction']
    }
  },
  {
    name: 'showMotorShortcutRail',
    description:
      'Open a persistent left shortcut rail with large touch targets and key hints for motor accessibility',
    parameters: {
      type: 'object',
      properties: {
        primaryTag: { type: 'string' },
        primaryText: { type: 'string' },
        prioritizeNearby: { type: 'boolean' }
      }
    }
  }
];

// WebSocket server for real-time communication
const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws) => {
  console.log('Extension connected via WebSocket');

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Received from extension:', data);

      // Process with Hermes
      const hermesResponse = await callHermes(data);

      // Send back to extension
      ws.send(JSON.stringify(hermesResponse));
    } catch (error) {
      console.error('Error processing message:', error);
      ws.send(JSON.stringify({ error: error.message }));
    }
  });

  ws.on('close', () => {
    console.log('Extension disconnected');
  });
});

// Normalize payloads from the extension (flat) vs generic { context, metrics }
function normalizeHermesPayload(userData) {
  const action = userData?.action || userData?.context?.action || 'analyze';
  const url =
    userData?.url ||
    userData?.context?.url ||
    userData?.context?.page ||
    'unknown';
  const nestedMetrics = userData?.metrics || userData?.context?.metrics || {};
  const missList = nestedMetrics.missClicks;
  const missCount = Array.isArray(missList)
    ? missList.length
    : Number(missList) || 0;
  const element = userData?.element || userData?.context?.element;
  const targetSelector =
    element?.id ? `#${element.id}` : element?.tagName || 'unknown';
  const metrics = {
    ...nestedMetrics,
    missClicks: missCount,
    targetSelector,
    shakeDetected:
      nestedMetrics.tremorDetected === true || nestedMetrics.shakeDetected === true,
    escalation: userData?.escalation === true || nestedMetrics?.escalation === true
  };
  return { action, url, metrics, element, userData };
}

// Call Hermes API with function calling
async function callHermes(userData) {
  const { action, url, metrics, element } = normalizeHermesPayload(userData);

  // Construct prompt based on user behavior
  const systemPrompt = `You are an accessibility AI assistant that helps users with motor impairments interact with web interfaces.
Analyze the user's interaction patterns and decide which accessibility.functions to call.
Be proactive: repeated near-misses mean the user needs larger targets, magnetic assist, simplified interactions, and a visible shortcut rail.`;

  const userPrompt = `User interaction data:
- Action: ${action}
- Miss-click events (recent window): ${metrics.missClicks}
- Tremor / shake detected: ${metrics.shakeDetected || false}
- Target element summary: ${element?.tagName || 'unknown'} ${element?.id ? '#' + element.id : ''}
- Escalation (prior assist not enough): ${metrics.escalation || false}
- Page: ${url}

Determine the best accessibility adaptations to apply.`;

  try {
    // For demo purposes, we'll simulate Hermes responses
    // In production, replace with actual Hermes API call
    const response = await simulateHermesCall(userPrompt, metrics, element);

    /* Actual Hermes API call would look like:
    const response = await axios.post(HERMES_API_URL, {
      model: 'hermes-3',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      functions: hermesFunctions,
      function_call: 'auto',
      temperature: 0.1,
      max_tokens: 500
    }, {
      headers: {
        'Authorization': `Bearer ${HERMES_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    */

    return response;
  } catch (error) {
    console.error('Hermes API error:', error);
    return { error: 'Failed to process with Hermes' };
  }
}

// Simulate Hermes responses for demo
function simulateHermesCall(prompt, metrics, element) {
  const missClicks = metrics?.missClicks || 0;
  const shakeDetected = metrics?.shakeDetected || false;
  const escalation = metrics?.escalation || false;

  // Intelligent response based on user behavior
  const functions = [];
  let reasoning = '';
  const scale = escalation ? 2.25 : missClicks >= 3 ? 2.0 : 1.6;
  const magStrength = escalation ? 90 : missClicks >= 4 ? 82 : 72;
  const sensitivity = escalation ? 0.22 : 0.3;

  if (missClicks >= 3) {
    functions.push({
      name: 'enlargeClickTarget',
      arguments: { selector: metrics.targetSelector, scale }
    });
    functions.push({
      name: 'addMagneticSnap',
      arguments: { selector: metrics.targetSelector, strength: magStrength }
    });
    functions.push({
      name: 'showMotorShortcutRail',
      arguments: {
        primaryTag: element?.tagName,
        primaryText: (element?.text || '').slice(0, 80),
        prioritizeNearby: true
      }
    });
    reasoning =
      'Repeated mis-clicks detected. Escalating target size, magnetic snap, and opening the motor shortcut rail.';
  }

  if (shakeDetected) {
    functions.push({
      name: 'adjustCursorSensitivity',
      arguments: { sensitivity, radius: escalation ? 120 : 100 }
    });
    reasoning += ' Tremor detected. Reducing cursor sensitivity in target zones.';
  }

  if (metrics?.timeToClick > 3000) {
    functions.push({
      name: 'simplifyInteraction',
      arguments: { originalAction: 'hover-then-click', simplifiedAction: 'direct-click' }
    });
    reasoning += ' Slow interaction detected. Simplifying UI interactions.';
  }

  return {
    success: true,
    functions,
    reasoning: reasoning || 'No strong accessibility signal in this window.',
    confidence: 0.92
  };
}

// REST API endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'ok', hermes: 'connected' });
});

app.post('/analyze', async (req, res) => {
  const result = await callHermes(req.body);
  res.json(result);
});

app.listen(PORT, () => {
  console.log(`Adaptive Access AI Server running on port ${PORT}`);
  console.log(`WebSocket server running on port 8080`);
});