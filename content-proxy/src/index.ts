import axios from 'axios';
import * as cheerio from 'cheerio';
import express, { Request, Response } from 'express';
import { chromium } from 'playwright';

const customStyle = `
      <style>
        .coop-image-grayscale { filter: grayscale(100%); }

        .coop-image-blur-0 { filter: blur(0px); }
        .coop-image-blur-4 { filter: blur(4px); }
        .coop-image-blur-8 { filter: blur(8px); }
        .coop-image-blur-12 { filter: blur(12px); }
        .coop-image-blur-16 { filter: blur(16px); }
        .coop-image-blur-24 { filter: blur(24px); }
        .coop-image-blur-40 { filter: blur(40px); }

        .coop-image-grayscale.coop-image-blur-0 { filter: grayscale(100%) blur(0px); }
        .coop-image-grayscale.coop-image-blur-4 { filter: grayscale(100%) blur(4px); }
        .coop-image-grayscale.coop-image-blur-8 { filter: grayscale(100%) blur(8px); }
        .coop-image-grayscale.coop-image-blur-12 { filter: grayscale(100%) blur(12px); }
        .coop-image-grayscale.coop-image-blur-16 { filter: grayscale(100%) blur(16px); }
        .coop-image-grayscale.coop-image-blur-24 { filter: grayscale(100%) blur(24px); }
        .coop-image-grayscale.coop-image-blur-40 { filter: grayscale(100%) blur(40px); }

        .coop-image-blur-0:hover,
        .coop-image-blur-4:hover,
        .coop-image-blur-8:hover,
        .coop-image-blur-12:hover,
        .coop-image-blur-16:hover,
        .coop-image-blur-24:hover,
        .coop-image-blur-40:hover {
          filter: blur(0px);
        }

        .coop-image-grayscale.coop-image-blur-0:hover,
        .coop-image-grayscale.coop-image-blur-4:hover,
        .coop-image-grayscale.coop-image-blur-8:hover,
        .coop-image-grayscale.coop-image-blur-12:hover,
        .coop-image-grayscale.coop-image-blur-16:hover,
        .coop-image-grayscale.coop-image-blur-24:hover,
        .coop-image-grayscale.coop-image-blur-40:hover {
          filter: grayscale(100%) blur(0px);
        }
      </style>
    `;

const app = express();
const port = process.env.PORT || 4000;
const GOOGLE_TRANSLATE_API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY;
const CONTENT_BASE_URL = process.env.CONTENT_BASE_URL || 'https://www.example.com';

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use('/api/v1/ready', (_req, res, _next) => {
  res.status(200).send('OK');
  return;
});

app.get('/', async (req: Request, res: Response) => {
  const contentUrl = req.query.contentUrl;

  if (typeof contentUrl !== 'string') {
    return res
      .status(400)
      .send('Invalid or missing "contentUrl" query parameter');
  }

  try {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    await page.goto(contentUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 120000 });

    // Wait for images to load
    await page.evaluate(async () => {
      const selectors = Array.from(document.images, (img) => img.src);
      await Promise.all(
        selectors.map((src) => {
          return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = src;
            img.onload = resolve;
            img.onerror = reject;
          });
        }),
      );
    });

    let pageContent = await page.content();

    await browser.close();

    const $ = cheerio.load(pageContent);

    $('script').remove();

    // Remove the floating table of contents (Notion-specific)
    $('.notion-floating-table-of-contents').remove();

    // Also remove by the alternative class name that sometimes appears (Notion-specific)
    $('.hide-scrollbar.ignore-scrolling-container').remove();

    // Remove header buttons (Notion-specific)
    const buttons = $('header').find('div[role="button"]');

    buttons.each((_, button) => {
      const $button = $(button);
      if (
        $button.find('svg.search').length > 0 ||
        $button.find('svg.duplicate').length > 0 ||
        $button.find('svg.notionLogo').length > 0 ||
        $button.attr('aria-label') === 'More actions'
      ) {
        $button.remove();
      }
    });

    // Remove width from <main> element
    const mainElem = $('main');
    const styleAttr = mainElem.attr('style');
    if (styleAttr) {
      const newStyle = styleAttr.replace(/width:\s*\d+px;?/g, '').trim();
      mainElem.attr('style', newStyle);
    }

    $('img').each((_, img) => {
      const src = $(img).attr('src');
      if (src && src.startsWith('/')) {
        const url = new URL(contentUrl);
        $(img).attr('src', `${url.origin}${src}`);
      }
    });

    $('img').removeAttr('loading');

    // Update href attributes of <a> tags to support links to other pages
    $('a').each((_, elem) => {
      const href = $(elem).attr('href');
      if (!href) {
        return;
      }

      const absoluteHref = href.startsWith('/')
        ? new URL(href, contentUrl).href
        : href;
      $(elem).attr('href', `/?contentUrl=${encodeURIComponent(absoluteHref)}`);
    });

    const customScript = `
  <script>
    let originalTexts = {};

    function storeOriginalTexts() {
      const allElements = document.querySelectorAll('*');
      allElements.forEach((element, elementIndex) => {
        element.childNodes.forEach((node, nodeIndex) => {
          if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
            originalTexts[elementIndex + "-" + nodeIndex] = node.textContent;
          }
        });
      });
    }

    function splitTextNodesIntoBatches(textsToTranslate, allTextNodes) {
      const MAX_SEGMENTS = 128;
      const MAX_CHARS = 30000;
      const batches = [];

      let currentBatchTexts = [];
      let currentBatchNodes = [];
      let currentBatchChars = 0;

      for (let i = 0; i < textsToTranslate.length; i++) {
        const text = textsToTranslate[i];
        const node = allTextNodes[i];
        const textLength = new Blob([text]).size;

        // If adding this text would exceed limits, start a new batch
        if (currentBatchTexts.length >= MAX_SEGMENTS || currentBatchChars + textLength > MAX_CHARS) {
          batches.push({
            texts: currentBatchTexts,
            nodes: currentBatchNodes
          });
          currentBatchTexts = [];
          currentBatchNodes = [];
          currentBatchChars = 0;
        }

        currentBatchTexts.push(text);
        currentBatchNodes.push(node);
        currentBatchChars += textLength;
      }

      if (currentBatchTexts.length > 0) {
        batches.push({
          texts: currentBatchTexts,
          nodes: currentBatchNodes
        });
      }

      return batches;
    }

    async function translateTexts(apiKey) {
      if (!apiKey) {
        console.warn('No Google Translate API key provided');
        return;
      }

      storeOriginalTexts();

      const allElements = document.querySelectorAll('*');
      const textsToTranslate = [];
      const allTextNodes = [];

      allElements.forEach((element, elementIndex) => {
        element.childNodes.forEach((node, nodeIndex) => {
          if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
            textsToTranslate.push(node.textContent);
            allTextNodes.push(node);
          }
        });
      });

      const batches = splitTextNodesIntoBatches(textsToTranslate, allTextNodes);

      for (const batch of batches) {
        try {
          const response = await fetch(\`https://translation.googleapis.com/language/translate/v2?key=\${apiKey}\`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              q: batch.texts,
              target: 'en',
              source: 'auto'
            })
          });

          const data = await response.json();

          if (data.data && data.data.translations) {
            batch.nodes.forEach((node, index) => {
              if (data.data.translations[index]) {
                node.textContent = data.data.translations[index].translatedText;
              }
            });
          }
        } catch (error) {
          console.error('Translation error:', error);
        }
      }

      // Send message to parent window
      window.parent.postMessage({
        type: 'translationStatus',
        isTranslating: false
      }, '*');
    }

    function revertTexts() {
      const allElements = document.querySelectorAll('*');
      allElements.forEach((element, elementIndex) => {
        element.childNodes.forEach((node, nodeIndex) => {
          if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
            const key = elementIndex + "-" + nodeIndex;
            if (originalTexts[key]) {
              node.textContent = originalTexts[key];
            }
          }
        });
      });
    }

    window.addEventListener('message', function(msg) {
      if (!msg.data || msg.data.type !== 'customControl') {
        return;
      }

      const { blur, grayscale, shouldTranslate } = msg.data;

      const blurClass = "coop-image-blur-" + (blur * 4 || 0);
      const grayscaleClass = "coop-image-grayscale";

      document.querySelectorAll('img').forEach((img) => {
        img.classList.remove(...img.classList);
        if (blur > 0) img.classList.add(blurClass);
        if (grayscale) img.classList.add(grayscaleClass);
      });

      const apiKey = '${GOOGLE_TRANSLATE_API_KEY}';
      if (typeof shouldTranslate === 'boolean') {
        if (shouldTranslate) {
          translateTexts(apiKey);
        } else {
          revertTexts();
        }
      }
    };
  </script>
`;

    $('head').append(customStyle);
    $('body').append(customScript);

    pageContent = $.html();
    return res.send(pageContent);
  } catch (error: any) {
    return res
      .status(500)
      .send(`Error processing content: ${error.message}`);
  }
});

// Proxy CSS files
app.get('/_assets/*.css', async (req: Request, res: Response) => {
  const assetUrl = `${CONTENT_BASE_URL}${req.originalUrl}`;

  try {
    const response = await axios.get(assetUrl, { responseType: 'arraybuffer' });

    res.set('Content-Type', 'text/css');
    return res.send(response.data);
  } catch (error: any) {
    return res.status(500).send('Error fetching CSS asset');
  }
});

// Proxy JS files
// app.get('/_assets/*.js', async (req: Request, res: Response) => {
//   const assetUrl = `${CONTENT_BASE_URL}${req.originalUrl}`;
//
//   try {
//     const response = await axios.get(assetUrl, { responseType: 'arraybuffer' });
//
//     res.set('Content-Type', 'application/javascript');
//     return res.send(response.data);
//   } catch (error: any) {
//     return res.status(500).send('Error fetching JS asset');
//   }
// });

const extensionContentTypeMap: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  svg: 'image/svg+xml',
  woff2: 'font/woff2',
  default: 'application/octet-stream',
};

// Proxy other static assets (e.g., images, fonts)
app.get('/_assets/*', async (req: Request, res: Response) => {
  const assetUrl = `${CONTENT_BASE_URL}${req.originalUrl}`;

  try {
    const response = await axios.get(assetUrl, { responseType: 'arraybuffer' });

    // Determine content type based on the file extension
    const extension = assetUrl.split('.').pop()?.toLowerCase();
    const contentType = extension
      ? extensionContentTypeMap[extension]
      : extensionContentTypeMap.default;

    res.set('Content-Type', contentType);
    return res.send(response.data);
  } catch (error: any) {
    return res.status(500).send('Error fetching asset');
  }
});

app.listen(port, () => {
  console.log(`Content proxy server is running on port ${port}`);
  console.log(`Content base URL: ${CONTENT_BASE_URL}`);
});
