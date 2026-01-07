# Troubleshooting Guide

## Issue: "Failed to fetch" Error

This error typically occurs due to one of these reasons:

### 1. **CORS (Cross-Origin) Issue**
The Anthropic API should support CORS, but if you're getting this error:

**Solution A - Check Browser Console:**
1. Open the app in your browser
2. Press F12 to open Developer Tools
3. Go to the Console tab
4. Try to make an API call
5. Look for detailed error messages

You should see logs like:
```
Making API call to: https://api.anthropic.com/v1/messages
Using model: claude-sonnet-4-20250514
Response status: 200
```

If you see CORS errors instead, the browser is blocking the request.

**Solution B - Try a Different Browser:**
- Try Chrome, Firefox, or Safari
- Make sure you're using HTTPS (GitHub Pages uses HTTPS by default)

### 2. **Invalid API Key**

**Symptoms:**
- Error message mentions "401" or "unauthorized"
- Console shows "Invalid API key"

**Solution:**
1. Go to https://console.anthropic.com/
2. Check your API key starts with `sk-ant-`
3. Create a new key if needed
4. Clear the old key in the app (Settings → Clear API Key)
5. Enter the new key

### 3. **Incorrect Model Name**

**Symptoms:**
- Error mentions "model not found" or similar

**Current Configuration:**
- Model: `claude-sonnet-4-20250514`
- This should work, but if not, try: `claude-sonnet-3-5-20241022`

**To Change Model:**
Edit `config.js`, line 5:
```javascript
MODEL: 'claude-sonnet-3-5-20241022',  // Try this if current model doesn't work
```

### 4. **Rate Limiting**

**Symptoms:**
- Error mentions "429" or "rate limit"

**Solution:**
- Wait a few minutes
- Check your Anthropic console for rate limits
- Reduce the number of API calls

### 5. **Network Issues**

**Solution:**
- Check your internet connection
- Try disabling VPN if you're using one
- Check if https://api.anthropic.com is accessible

## Issue: Word Definition Not Working

**Fixed in latest version!** 
The defineWord() function now properly calls the API instead of showing a placeholder.

Make sure you have the updated `app.js` file.

## Debugging Steps

### Step 1: Open Browser Console
Press F12 → Console tab

### Step 2: Check for Errors
Look for red error messages

### Step 3: Test API Key Manually
In the console, paste this (replace YOUR_API_KEY):

```javascript
fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'YOUR_API_KEY',
    'anthropic-version': '2023-06-01'
  },
  body: JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 100,
    messages: [{role: 'user', content: 'Hello'}]
  })
})
.then(r => r.json())
.then(d => console.log('Success:', d))
.catch(e => console.error('Error:', e));
```

If this works, the API key is valid. If not, check the error message.

## Common Error Messages

### "Network error: Unable to connect to Anthropic API"
- Check internet connection
- Check if site is loaded via HTTPS
- Try different browser

### "Invalid API key"
- API key is wrong or expired
- Create new key at console.anthropic.com

### "Rate limit exceeded"
- Wait a few minutes
- Check usage at console.anthropic.com

### "API call limit reached (50 calls per session)"
- This is the app's built-in limit
- Refresh the page to reset
- Or increase limit in Settings

## Still Not Working?

### Check These Files Are Updated:
1. `app.js` - Should have better error messages and console.log statements
2. `config.js` - Should have MAX_TOKENS: 2048

### Try This:
1. Clear browser cache (Ctrl+Shift+Delete)
2. Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)
3. Try in a private/incognito window
4. Check GitHub Pages is properly deployed

### Last Resort:
If nothing works, the issue might be that the Anthropic API doesn't fully support CORS from GitHub Pages. In that case, you would need a backend proxy, which is more complex.

Let me know if you need help setting that up!
