# Content Proxy Service

A generic content proxy service for iframe rendering with safety controls, translation capabilities, and content sanitization.

## Features

- **Generic Content Support**: Works with any web content, not just specific platforms
- **Safety Controls**: Configurable blur and grayscale filters for images
- **Translation**: Google Translate integration for content localization
- **Content Sanitization**: Removes scripts and unwanted UI elements
- **Asset Proxying**: Handles CSS, images, and other static assets

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `4000` |
| `GOOGLE_TRANSLATE_API_KEY` | Google Translate API key for translation features | Required for translation |
| `CONTENT_BASE_URL` | Base URL for proxying assets (e.g., `https://www.example.com`) | `https://www.example.com` |

## Usage

### Basic Setup

1. Set environment variables:
   ```bash
   export GOOGLE_TRANSLATE_API_KEY="your-api-key"
   export CONTENT_BASE_URL="https://your-content-domain.com"
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the service:
   ```bash
   npm start
   ```

### API Endpoints

- `GET /` - Main content proxy endpoint
  - Query parameter: `contentUrl` - The URL of the content to proxy
  - Returns: HTML content with safety controls and translation features

- `GET /_assets/*` - Asset proxy for CSS, images, fonts, etc.
- `GET /api/v1/ready` - Health check endpoint

### Client Integration

The service communicates with client applications via postMessage API:

```javascript
// Send control commands to the iframe
iframe.contentWindow.postMessage({
  type: 'customControl',
  blur: 2,           // Blur level (0-10)
  grayscale: true,   // Enable/disable grayscale
  shouldTranslate: false  // Enable/disable translation
}, 'https://your-proxy-domain.com');

// Listen for translation status updates
window.addEventListener('message', (event) => {
  if (event.data.type === 'translationStatus') {
    console.log('Translation status:', event.data.isTranslating);
  }
});
```

## Configuration Examples

```bash
export CONTENT_BASE_URL="https://your-platform.com"
```

## Development

```bash
# Install dependencies
npm install

# Start development server with hot reload
npm start

# Run tests
npm test

# Build for production
npm run build
```

## Docker

```bash
# Build image
docker build -t content-proxy .

# Run container
docker run -p 4000:4000 \
  -e GOOGLE_TRANSLATE_API_KEY="your-key" \
  -e CONTENT_BASE_URL="https://your-domain.com" \
  content-proxy
```
