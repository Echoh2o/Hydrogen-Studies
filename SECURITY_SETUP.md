# Production Security Configuration

## Required Environment Variables

### Production Requirements

The following environment variables are **REQUIRED** in production:

1. **SESSION_SECRET** - Secure session encryption key
2. **ALLOWED_ORIGINS** - Comma-separated list of allowed CORS origins
3. **ADMIN_USER_IDS** - Comma-separated list of admin user identifiers
4. **DATABASE_URL** - PostgreSQL connection string (already configured)

## 1. Session Secret Configuration

### Generate a Secure Session Secret

Use one of these methods to generate a cryptographically secure session secret:

```bash
# Method 1: Using OpenSSL (recommended)
openssl rand -hex 32

# Method 2: Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Method 3: Using Python
python -c "import secrets; print(secrets.token_hex(32))"
```

### Set the Session Secret

Add to your environment variables:

```bash
SESSION_SECRET=your_64_character_hex_string_here
```

**Requirements:**
- Minimum 32 characters (64 hex characters recommended)
- Must be unique per environment
- Never commit to version control
- Rotate periodically for security

## 2. CORS Configuration

### Production CORS Setup

Set allowed origins for your production domains:

```bash
# Single domain
ALLOWED_ORIGINS=https://yourdomain.com

# Multiple domains (comma-separated)
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com,https://www.yourdomain.com
```

**Important:**
- Only include HTTPS origins in production
- Be specific - avoid wildcards
- Include all subdomains that need access
- Don't include trailing slashes

### Development CORS

In development, CORS is automatically configured to allow all localhost origins.

## 3. Session Storage

Sessions are now stored in PostgreSQL using `connect-pg-simple`, providing:

- **Persistence across restarts** - Sessions survive server restarts
- **Horizontal scaling** - Sessions shared across multiple servers
- **Automatic cleanup** - Expired sessions pruned every 15 minutes
- **Security** - Sessions encrypted with SESSION_SECRET

### Session Table

The session table is automatically created with this structure:

```sql
CREATE TABLE IF NOT EXISTS session (
  sid varchar PRIMARY KEY,
  sess json NOT NULL,
  expire timestamp(6) NOT NULL
);
CREATE INDEX IDX_session_expire ON session(expire);
```

## 4. CSRF Protection

CSRF protection is now enabled for all state-changing operations.

### How It Works

1. **Token Generation**: A CSRF token is generated for each session
2. **Double Submit**: Token sent as both cookie and request parameter
3. **Validation**: Server validates token on POST/PUT/DELETE requests

### Client Implementation

#### For Forms (HTML)

Include the CSRF token in your forms:

```html
<form method="POST" action="/api/endpoint">
  <input type="hidden" name="_csrf" value="{{csrfToken}}">
  <!-- Your form fields -->
</form>
```

#### For AJAX/Fetch Requests

Include the token in the header:

```javascript
// Get token from meta tag or API response
const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;

// Include in fetch requests
fetch('/api/endpoint', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken
  },
  credentials: 'include', // Important for cookies
  body: JSON.stringify(data)
});
```

#### For React/API Clients

The server provides the CSRF token in response headers:

```javascript
// After any GET request, extract the token
const token = response.headers.get('X-CSRF-Token');

// Use in subsequent POST/PUT/DELETE requests
```

### Excluded Endpoints

The following endpoints don't require CSRF tokens:
- All GET/HEAD/OPTIONS requests
- `/health` - Health check endpoint
- `/api/stats` - Read-only statistics
- `/api/search` - Search queries
- `/api/categories` - Category listings

## 5. Security Checklist

### Before Deployment

- [ ] Generate unique SESSION_SECRET (64+ characters)
- [ ] Set ALLOWED_ORIGINS to production domains only
- [ ] Configure ADMIN_USER_IDS with secure identifiers
- [ ] Test session persistence across restarts
- [ ] Verify CSRF protection on forms
- [ ] Test CORS with production domains
- [ ] Enable HTTPS in production
- [ ] Set secure cookie flags

### Regular Maintenance

- [ ] Rotate SESSION_SECRET quarterly
- [ ] Review ALLOWED_ORIGINS for unused domains
- [ ] Monitor session table size
- [ ] Check for CSRF errors in logs
- [ ] Update admin user list as needed

## 6. Testing Security

### Test Session Persistence

```bash
# 1. Login to your application
# 2. Note your session cookie
# 3. Restart the server
# 4. Verify you're still logged in
```

### Test CSRF Protection

```bash
# This should fail (no CSRF token)
curl -X POST https://yourapp.com/api/endpoint \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'

# This should succeed (with token)
curl -X POST https://yourapp.com/api/endpoint \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: your_token_here" \
  -d '{"test": "data"}'
```

### Test CORS

```javascript
// From a different domain, this should fail in production
fetch('https://yourapp.com/api/endpoint', {
  credentials: 'include'
}).catch(err => console.log('CORS blocked:', err));
```

## 7. Troubleshooting

### Session Issues

**Problem**: Sessions lost on restart
- **Solution**: Check DATABASE_URL and session table creation

**Problem**: "SESSION_SECRET is required" error
- **Solution**: Set SESSION_SECRET environment variable

### CSRF Issues

**Problem**: "CSRF token missing" errors
- **Solution**: Ensure client sends X-CSRF-Token header

**Problem**: "Invalid CSRF token" errors
- **Solution**: Check token is from current session

### CORS Issues

**Problem**: CORS errors in production
- **Solution**: Add origin to ALLOWED_ORIGINS

**Problem**: Credentials not working
- **Solution**: Ensure `credentials: 'include'` in requests

## Security Warnings

⚠️ **Never**:
- Commit SESSION_SECRET to version control
- Use weak or predictable secrets
- Share secrets between environments
- Disable CSRF protection for convenience
- Use wildcard (*) CORS origins in production

✅ **Always**:
- Use HTTPS in production
- Rotate secrets regularly
- Monitor for security errors
- Test security features before deployment
- Keep security dependencies updated