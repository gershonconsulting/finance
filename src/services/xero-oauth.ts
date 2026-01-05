// Xero OAuth Service for Cloudflare Workers

export interface XeroTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  tenantId?: string;
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

  // Exchange authorization code for tokens
  async exchangeCodeForTokens(code: string): Promise<XeroTokens> {
    const tokenEndpoint = 'https://identity.xero.com/connect/token';
    
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: this.redirectUri,
    });

    const credentials = btoa(`${this.clientId}:${this.clientSecret}`);

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in * 1000),
    };
  }

  // Refresh access token
  async refreshAccessToken(refreshToken: string): Promise<XeroTokens> {
    const tokenEndpoint = 'https://identity.xero.com/connect/token';
    
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    const credentials = btoa(`${this.clientId}:${this.clientSecret}`);

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token refresh failed: ${error}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in * 1000),
    };
  }

  // Get tenant ID
  async getTenantId(accessToken: string): Promise<string> {
    const response = await fetch('https://api.xero.com/connections', {
      headers: {
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

    return connections[0].tenantId;
  }
}
