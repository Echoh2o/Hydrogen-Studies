# Pre-Deployment Quality Checklist

## Automated Checks Required Before Deployment

### 1. Build Verification
- [ ] Clean build completes without errors
- [ ] `dist/index.js` exists and is functional
- [ ] `dist/index.html` exists with correct assets
- [ ] No TypeScript compilation errors
- [ ] All dependencies resolve correctly

### 2. Staging Server Test
- [ ] Production server starts successfully from built files
- [ ] Database migrations run without errors
- [ ] All critical API endpoints respond correctly
- [ ] Frontend loads without JavaScript errors
- [ ] Search functionality works
- [ ] Study data loads correctly

### 3. API Endpoint Validation
- [ ] `/api/search/trending` - Returns trending terms
- [ ] `/api/search/enhanced` - Returns study results
- [ ] `/api/consumer-categories/counts` - Returns category data
- [ ] `/api/studies` - Returns paginated studies
- [ ] `/api/studies/:id` - Returns individual study
- [ ] `/api/categories` - Returns category list
- [ ] `/health` - Returns server status

### 4. Database Integrity
- [ ] Studies table accessible (1,304 records expected)
- [ ] Categories table populated
- [ ] Consumer categories data complete
- [ ] Image URLs functional
- [ ] No broken foreign key relationships

### 5. Performance Standards
- [ ] API responses < 2 seconds
- [ ] Frontend loads < 5 seconds
- [ ] Search results < 3 seconds
- [ ] Database queries optimized
- [ ] No memory leaks detected

### 6. Feature Parity Check
- [ ] Search works identically in preview vs deployed
- [ ] Study details page loads correctly
- [ ] Category filtering functional
- [ ] Image generation admin controls accessible
- [ ] Enrichment admin controls functional

### 7. Environment Configuration
- [ ] Production environment variables set
- [ ] Database URL configured correctly
- [ ] Static file serving working
- [ ] CORS policies appropriate
- [ ] Error handling functional

## Manual Testing Checklist

### User Journey Testing
1. **Homepage Load**
   - [ ] Page loads without errors
   - [ ] Search box functional
   - [ ] Category buttons work
   - [ ] Trending terms display

2. **Search Functionality**
   - [ ] Basic search returns results
   - [ ] Advanced filters work
   - [ ] Pagination functions
   - [ ] No results handled gracefully

3. **Study Details**
   - [ ] Individual studies load
   - [ ] Images display correctly
   - [ ] All study data present
   - [ ] Related studies suggested

4. **Admin Functions** (if applicable)
   - [ ] Image generation controls work
   - [ ] Enrichment controls functional
   - [ ] Statistics display correctly

## Deployment Readiness Criteria

**DEPLOY ONLY IF:**
- All automated checks pass
- No critical errors in staging tests
- Performance meets standards
- Feature parity confirmed
- Manual testing complete

**DO NOT DEPLOY IF:**
- Any API endpoints failing
- Database connection issues
- Build errors present
- Performance degraded
- Missing core functionality

## Post-Deployment Verification

**Immediately After Deployment:**
1. Test main search functionality
2. Verify database connectivity
3. Check study detail pages
4. Confirm image loading
5. Monitor error logs for 10 minutes

**If Issues Found:**
1. Document specific problems
2. Check deployment logs
3. Compare with staging environment
4. Rollback if critical issues
5. Fix and redeploy with full testing

## Quality Improvement Actions

**To Prevent Future Issues:**
1. Run staging tests before every deployment
2. Maintain identical preview/staging/production environments
3. Use feature flags for new functionality
4. Implement health checks and monitoring
5. Keep deployment rollback procedures ready