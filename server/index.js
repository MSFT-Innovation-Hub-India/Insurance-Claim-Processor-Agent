import express from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

try {
  process.loadEnvFile();
} catch {
  // No .env file; rely on real environment variables.
}

const { LOGIC_APP_URL, PORT = 3001 } = process.env;
if (!LOGIC_APP_URL) {
  console.error('LOGIC_APP_URL is not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_FILE_BYTES = 10 * 1024 * 1024;

const app = express();
app.use(express.json({ limit: '15mb' }));

app.post('/api/claims', async (req, res) => {
  const { fileName, fileContent } = req.body ?? {};
  if (typeof fileContent !== 'string' || !fileContent) {
    return res.status(400).json({ error: 'fileContent (base64) is required.' });
  }

  const bytes = Buffer.from(fileContent, 'base64');
  if (bytes.length > MAX_FILE_BYTES) {
    return res.status(413).json({ error: 'File exceeds the 10 MB limit.' });
  }
  if (!bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    return res.status(400).json({ error: 'Only .png files are accepted.' });
  }

  try {
    const response = await fetch(LOGIC_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName, contentType: 'image/png', fileContent }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error(`Logic App returned ${response.status}: ${detail}`);
      return res.status(502).json({ error: `Logic App returned ${response.status}.`, detail });
    }

    res.status(202).json({
      status: response.status,
      runId: response.headers.get('x-ms-workflow-run-id'),
    });
  } catch (err) {
    console.error('Failed to reach Logic App:', err);
    res.status(502).json({ error: 'Could not reach the Logic App.' });
  }
});

const distDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
if (existsSync(distDir)) {
  app.use(express.static(distDir));
}

app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
