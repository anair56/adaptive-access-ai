# Hex Project Setup - Correct Implementation

## How Hex API Actually Works

Hex doesn't publish individual functions as APIs. Instead, you:
1. Create **Input Parameters** in your project
2. Run the entire project via API
3. Retrieve outputs

## Setting Up Your Hex Project

### 1. Add Input Parameters in Hex

In your Hex project, add these **Input Parameters** (click "+ Add parameter" in Hex):

```python
# Input Parameter 1: data_points (Text/JSON)
# Default value: []

# Input Parameter 2: action (Text)
# Default value: "analyze"
```

### 2. Update First Cell to Use Parameters

Replace Cell 1 with:

```python
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import json
import warnings
warnings.filterwarnings('ignore')

# Get input parameters from Hex
input_data = data_points if 'data_points' in locals() else '[]'
input_action = action if 'action' in locals() else 'analyze'

# Parse input data
try:
    if isinstance(input_data, str):
        new_data_points = json.loads(input_data)
    else:
        new_data_points = input_data
except:
    new_data_points = []

# Initialize or load data
if 'tremor_data' not in globals():
    tremor_data = pd.DataFrame()

# Add new data if provided
if new_data_points:
    new_df = pd.DataFrame(new_data_points)
    if 'timestamp' in new_df.columns:
        new_df['timestamp'] = pd.to_datetime(new_df['timestamp'], unit='ms')
    tremor_data = pd.concat([tremor_data, new_df], ignore_index=True)
    print(f"✅ Received {len(new_data_points)} data points")
else:
    # Generate sample data if none provided
    from your_previous_generate_sample_data_function
    tremor_data = generate_sample_data(500)
    print("📊 Using sample data")
```

### 3. Update Last Cell for Output

Replace the API endpoint cell with:

```python
# Final cell - Create output for API response
output_data = {
    'status': 'success',
    'timestamp': datetime.now().isoformat(),
    'analysis': {
        'patterns': patterns,
        'predictions': {
            'next_hour_severity': float(ml_results['next_hour_severity']),
            'confidence': float(ml_results['confidence'])
        },
        'recommendations': recommendations,
        'statistics': session_stats
    }
}

# IMPORTANT: Set this as project output in Hex
# In Hex: Click the variable 'output_data' → "Set as output"
print("✅ Analysis complete - output_data ready")
```

## Using the Hex API from Your Extension

### 1. Get Your Project Run URL

Your project run URL is:
```
https://app.hex.tech/api/v1/project/TremorSense-Analytics-032qH20mWsahimTong8CdU/run
```

### 2. Update hex-analytics.js

```javascript
async sendDataToHex(dataPoints) {
    const response = await fetch('https://app.hex.tech/api/v1/project/TremorSense-Analytics-032qH20mWsahimTong8CdU/run', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${this.config.workspaceToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            inputs: {
                data_points: JSON.stringify(dataPoints),
                action: 'analyze'
            }
        })
    });

    if (response.ok) {
        const result = await response.json();

        // Poll for completion
        const runId = result.run_id;
        return await this.pollForResults(runId);
    }
}

async pollForResults(runId) {
    const maxAttempts = 30;
    for (let i = 0; i < maxAttempts; i++) {
        const response = await fetch(`https://app.hex.tech/api/v1/run/${runId}/status`, {
            headers: {
                'Authorization': `Bearer ${this.config.workspaceToken}`
            }
        });

        const status = await response.json();

        if (status.state === 'completed') {
            // Get the outputs
            const outputResponse = await fetch(`https://app.hex.tech/api/v1/run/${runId}/outputs`, {
                headers: {
                    'Authorization': `Bearer ${this.config.workspaceToken}`
                }
            });
            return await outputResponse.json();
        }

        // Wait 1 second before polling again
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error('Hex run timeout');
}
```

## Alternative: Simple Backend Service

If you need real-time API responses, consider a lightweight backend:

### Option A: Vercel Serverless Function

Create `api/analyze.js`:

```javascript
export default async function handler(req, res) {
    // Forward to Hex
    const hexResponse = await fetch('https://app.hex.tech/api/v1/project/YOUR_PROJECT/run', {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer YOUR_TOKEN',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            inputs: {
                data_points: req.body.data_points
            }
        })
    });

    // Return immediately with acknowledgment
    res.status(200).json({
        status: 'processing',
        message: 'Analysis queued'
    });
}
```

### Option B: Use Hex's Scheduled Runs

1. Schedule your Hex project to run every 5 minutes
2. Have it read from a data store (Google Sheets, database)
3. Write results back to the data store
4. Extension reads from the data store

## The Simplest Solution

For the hackathon, the **simplest approach** is:

1. Keep the mock/demo mode in your extension (already working!)
2. Use Hex for batch analysis and reporting
3. Show Hex dashboards separately for detailed analytics

This way:
- Extension works instantly (mock data)
- Hex provides deep analysis when needed
- No complex API integration required