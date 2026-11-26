// Xero OAuth Service for Cloudflare Workers

export interface XeroTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  tenantId?: string;
}

const TOKEN_ENDPOINT = 'https://identity.xero.com/connect/token';

// v2.23.7 — Xero's identity host sits behind Akamai. Requests from a Worker
// carry no User-Agent, and Akamai's bot rules reject them ("Access Denied")
// from some Cloudflare locations — so sign-in worked for one user and failed
// for another depending on which data center served them. Always identify
// the client and accept JSON.
const XERO_HEADERS = {
  'User-Agent': 'GershonFinance/2.23.7 (+https://finance.gershon.ai)',
  'Accept': 'application/json',
};

function readableTokenError(status: number, text: string): string {
  if (/Access Denied|edgesuite|akamai/i.test(text)) {
    return `Xero's network refused the sign-in request (HTTP ${status}). Please try again in a minute.`;
  }
  return text.length > 500 ? text.slice(0, 500) + '…' : text;
}

export class XeroOAuthService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor(clientId: string, clientSecret: string, redirectUri: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
  }

  // Generate authorization URL
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: 'accounting.reports.read accounting.transactions.read accounting.contacts.read accounting.settings.read offline_access',
      state: state,
    });

    return `https://login.xero.com/identity/connect/authorize?${params.toString()}`;
  }

  // POST to Xero's token endpoint with proper headers, one retry on edge errors.
  private async tokenRequest(body: URLSearchParams, label: string): Promise<any> {
    const credentials = btoa(`${this.clientId}:${this.clientSecret}`);
    let lastStatus = 0;
    let lastText = '';

    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
          ...XERO_HEADERS,
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (response.ok) return response.json();

      lastStatus = response.status;
      lastText = await response.text();
      // Only retry edge/transient failures; a real OAuth error (400) won't change.
      if (![403, 429, 500, 502, 503, 504].includes(lastStatus)) break;
      await new Promise((r) => setTimeout(r, 800));
    }

    throw new Error(`${label} failed: ${readableTokenError(lastStatus, lastText)}`);
  }

  // Exchange authorization code for tokens
  async exchangeCodeForTokens(code: string): Promise<XeroTokens> {
    const data = await this.tokenRequest(
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: this.redirectUri,
      }),
      'Token exchange',
    );

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in * 1000),
    };
  }

  // Refresh access token
  async refreshAccessToken(refreshToken: string): Promise<XeroTokens> {
    const data = await this.tokenRequest(
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
      'Token refresh',
    );

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in * 1000),
    };
  }

  // Get tenant ID for Gershon Consulting LLC specifically
  async getTenantId(accessToken: string): Promise<string> {
    const response = await fetch('https://api.xero.com/connections', {
      headers: {
        ...XERO_HEADERS,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get tenant ID');
    }

    const connections = await response.json();
    if (!connections || connections.length === 0) {
      throw new Error('No Xero organizations connected');
    }

    // Filter for "Gershon Consulting LLC" organization only
    const gershonOrg = connections.find((conn: any) => 
      conn.tenantName === 'Gershon Consulting LLC'
    );

    if (!gershonOrg) {
      console.log('Available organizations:', connections.map((c: any) => c.tenantName));
      throw new Error('Gershon Consulting LLC organization not found. Please ensure you authorized the correct organization.');
    }

    console.log('Using organization:', gershonOrg.tenantName, 'Tenant ID:', gershonOrg.tenantId);
    return gershonOrg.tenantId;
  }
}
