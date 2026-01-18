# Xero Authentication Gate

## Overview
Implemented a **Xero OAuth-based authentication gate** that restricts dashboard access to users with valid Xero credentials only. This eliminates the need for separate email registration and ensures only authorized Xero users can view AR data.

## Features Implemented

### 1. **Login Page (Default View)**
- **Professional landing page** with gradient background
- **"Sign in with Xero" button** for OAuth authentication
- **Feature list** highlighting dashboard capabilities
- **Security indicator** showing OAuth 2.0 authentication
- **Responsive design** works on all devices

### 2. **Authentication Flow**
```
User visits → Login page shown → Click "Sign in with Xero" 
→ Xero OAuth → Successful auth → Dashboard shown
```

### 3. **Session Management**
- **Session token** stored in localStorage
- **Automatic check** on page load
- **Persistent login** across browser sessions
- **Token refresh** handled automatically

### 4. **Dashboard Access Control**
- **Hidden by default** until authentication
- **Only shown** after successful Xero OAuth
- **Logout button** in header to sign out
- **Automatic redirect** to login after logout

## User Experience

### First Visit (Not Authenticated)
1. User opens dashboard URL
2. Sees **login page** with:
   - Logo and title
   - "Sign in with Xero" button
   - Feature list (invoices, trends, clients, export)
   - Security badge

### Authentication
1. Click **"Sign in with Xero"**
2. Redirected to **Xero OAuth page**
3. Select organization (e.g., "Gershon Consulting LLC")
4. Grant permissions
5. Redirected back to dashboard
6. **Dashboard shown** with full access

### Return Visits (Already Authenticated)
1. Open dashboard URL
2. **Dashboard shown immediately** (no login needed)
3. Session persists until:
   - User clicks **Logout**
   - Browser clears localStorage
   - Token expires (refresh handled automatically)

## Technical Implementation

### Frontend (app.js)
```javascript
// Check auth on page load
document.addEventListener('DOMContentLoaded', async () => {
  const isAuthenticated = await checkAuthStatus();
  
  if (isAuthenticated) {
    // Show dashboard
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('dashboardPage').classList.remove('hidden');
    await loadDashboardData();
  } else {
    // Show login
    document.getElementById('loginPage').classList.remove('hidden');
    document.getElementById('dashboardPage').classList.add('hidden');
  }
});

// Login function
function loginWithXero() {
  window.location.href = '/auth/login';
}

// Logout function
function logout() {
  localStorage.removeItem('xero_session');
  window.location.reload();
}
```

### Backend (index.tsx)
```typescript
// Two-page structure
app.get('/', (c) => {
  return c.html(`
    <div id="loginPage">
      <!-- Login UI -->
    </div>
    <div id="dashboardPage" class="hidden">
      <!-- Dashboard UI -->
    </div>
  `);
});

// Existing OAuth endpoints unchanged
// - /auth/login
// - /auth/callback
// - /api/auth/status
```

### Session Storage
```
localStorage:
  - xero_session: <session_token>

Backend (in-memory, TODO: move to KV):
  - sessionId → { accessToken, refreshToken, tenantId, expiresAt }
```

## Security Features

### 1. **OAuth 2.0 Only**
- No custom credentials needed
- No email/password storage
- Xero handles authentication

### 2. **Token Management**
- Session tokens in localStorage
- Automatic token refresh (implemented)
- Secure token transmission (X-Session-Token header)

### 3. **Access Control**
- Dashboard hidden until auth
- API endpoints require valid session
- Automatic redirect on unauthorized

## User Interface

### Login Page Design
```
┌─────────────────────────────────────┐
│          📊 Xero Reports             │
│    Accounts Receivable Dashboard    │
│                                     │
│  ┌───────────────────────────────┐  │
│  │         Welcome               │  │
│  │  Sign in with your Xero      │  │
│  │  account to access dashboard │  │
│  │                               │  │
│  │  [🔑 Sign in with Xero]      │  │
│  │                               │  │
│  │  Access to:                   │  │
│  │  ✓ Real-time invoice tracking│  │
│  │  ✓ Payment trends analysis   │  │
│  │  ✓ Client payment insights   │  │
│  │  ✓ Google Sheets export      │  │
│  └───────────────────────────────┘  │
│                                     │
│      🔒 Secure OAuth 2.0            │
└─────────────────────────────────────┘
```

### Dashboard Header (After Login)
```
┌─────────────────────────────────────┐
│ 📊 Xero Reports Dashboard  [Logout] │
└─────────────────────────────────────┘
```

## Benefits

### 1. **Enhanced Security**
- No separate registration system to maintain
- Leverages Xero's existing security
- Reduces attack surface

### 2. **Better UX**
- Single sign-on experience
- No need to remember separate credentials
- Familiar Xero login flow

### 3. **Simplified Architecture**
- No email verification system needed
- No user database required
- Fewer backend endpoints

### 4. **Access Control**
- Only Xero users can access
- Automatic permissions from Xero
- Organizational access control

## Configuration

### Required Environment Variables
```
XERO_CLIENT_ID=<your_client_id>
XERO_CLIENT_SECRET=<your_client_secret>
XERO_REDIRECT_URI=https://your-domain.pages.dev/auth/callback
```

### Xero OAuth App Settings
```
Redirect URIs:
  - https://your-domain.pages.dev/auth/callback
  - https://3000-sandbox-id.sandbox.novita.ai/auth/callback (development)

Scopes:
  - accounting.reports.read
  - accounting.transactions.read
  - accounting.contacts.read
  - accounting.settings.read
  - offline_access
```

## Testing

### Test Authentication Flow
1. Clear localStorage: `localStorage.clear()`
2. Refresh page → Login page shown
3. Click "Sign in with Xero"
4. Complete OAuth → Dashboard shown
5. Refresh page → Dashboard shown (persisted)
6. Click Logout → Login page shown

### Test Unauthorized Access
```bash
# Without session token
curl http://localhost:3000/api/invoices/summary
# Returns: {"error": "Not authenticated"}

# With valid session token
curl -H "X-Session-Token: <token>" http://localhost:3000/api/invoices/summary
# Returns: invoice data
```

## Future Enhancements

### 1. **Remember Me**
- Optional extended session duration
- Checkbox on login page

### 2. **Multi-Organization**
- Switch between Xero organizations
- Organization selector after login

### 3. **Session Timeout Warning**
- Show modal before token expires
- Option to extend session

### 4. **Audit Logging**
- Track login/logout events
- User activity monitoring

## Troubleshooting

### Issue: Login Page Not Showing
**Solution**: Check if old session token exists
```javascript
localStorage.removeItem('xero_session');
window.location.reload();
```

### Issue: Stuck on Login Page After Auth
**Solution**: Verify OAuth callback is working
```bash
# Check if session token was set
localStorage.getItem('xero_session')
```

### Issue: Dashboard Shows Then Disappears
**Solution**: Check token validity
```bash
curl -H "X-Session-Token: <token>" http://localhost:3000/api/auth/status
```

## Summary

**Status**: ✅ **FULLY IMPLEMENTED**

**Components**:
- ✅ Professional login page
- ✅ Xero OAuth integration
- ✅ Session management
- ✅ Authentication gate
- ✅ Logout functionality
- ✅ Persistent sessions

**Result**: Only authorized Xero users can access the dashboard. No separate registration system needed.
