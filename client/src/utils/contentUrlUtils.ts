/**
 * Utility functions for detecting and handling content URLs that should be displayed in iframes
 */

  /**
   * Get the content URL patterns from environment variables
   * Defaults to 'notion' for backward compatibility
   * Supports comma-separated patterns
   */
  export function getContentUrlPatterns(): string[] {
    const pattern = import.meta.env.VITE_CONTENT_URL_PATTERN ?? 'notion';
    return pattern.split(',').map(p => p.trim()).filter(p => p.length > 0);
  }

/**
 * Check if a URL should be displayed in an iframe
 * @param url The URL to check
 * @returns True if the URL should be displayed in an iframe
 */
export function shouldDisplayInIframe(url: string): boolean {
  const patterns = getContentUrlPatterns();
  const urlLower = url.toLowerCase();
  return patterns.some(pattern => urlLower.includes(pattern.toLowerCase()));
}

/**
 * Check if a URL field value should be displayed in an iframe
 * @param urlField The URL field value to check
 * @returns True if the URL field should be displayed in an iframe
 */
export function shouldDisplayUrlFieldInIframe(urlField: any): boolean {
  if (!urlField || typeof urlField !== 'object' || !('type' in urlField)) {
    return false;
  }
  
  if (urlField.type !== 'URL' || typeof urlField.value !== 'string') {
    return false;
  }
  
  return shouldDisplayInIframe(urlField.value);
}

/**
 * Find the first URL that should be displayed in an iframe from a list of URL fields
 * @param urlFields Array of URL field values
 * @returns The first URL field that should be displayed in an iframe, or undefined
 */
export function findFirstIframeUrl(urlFields: any[]): any | undefined {
  return urlFields.find(shouldDisplayUrlFieldInIframe);
}
