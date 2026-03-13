import { google } from 'googleapis';
import { getAuthedOAuthClient } from './auth.mjs';

function extractApiError(error) {
  const status = error?.response?.status;
  const details = error?.response?.data?.error;
  const message = details?.message || error.message || 'Unknown API error';

  if (status === 401) {
    return 'Authentication failed or expired. Run `authenticate` again.';
  }
  if (status === 403) {
    if (String(message).toLowerCase().includes('sufficient permission for site')) {
      return `Access denied for this property. Run \`list-properties\` and use one of the exact returned identifiers (for example: sc-domain:example.com). Google treats URL-prefix and domain properties as different resources.`;
    }
    return `Access denied by Google API: ${message}`;
  }
  if (status === 400) {
    return `Invalid request sent to Google API: ${message}`;
  }

  return `Google API request failed: ${message}`;
}

async function withWebmastersClient(run) {
  const auth = await getAuthedOAuthClient();
  const webmasters = google.webmasters({ version: 'v3', auth });

  try {
    return await run(webmasters);
  } catch (error) {
    throw new Error(extractApiError(error));
  }
}

export async function listProperties() {
  return withWebmastersClient(async (webmasters) => {
    const response = await webmasters.sites.list();
    return response.data.siteEntry || [];
  });
}

export async function querySearchAnalytics({ siteUrl, startDate, endDate, dimensions = ['query'], rowLimit = 25 }) {
  return withWebmastersClient(async (webmasters) => {
    const response = await webmasters.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions,
        rowLimit,
      },
    });

    return response.data;
  });
}

export async function listSitemaps(siteUrl) {
  return withWebmastersClient(async (webmasters) => {
    const response = await webmasters.sitemaps.list({ siteUrl });
    return response.data.sitemap || [];
  });
}
