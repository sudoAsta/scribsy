## ⚠️ Important Notes

- `server/db.json` is excluded from Git to protect live post data.
- Don't manually edit or push changes to this file in GitHub.
- Live data is stored on your Render backend and updated through the app itself.

## Deployment Tips

- Make sure `.env` contains:
  VITE_API_URL=https://scribsy.onrender.com

- The Vite build uses `vite.config.js` to inject this URL automatically.