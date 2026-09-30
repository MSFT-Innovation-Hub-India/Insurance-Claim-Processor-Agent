import { useCallback, useEffect, useRef, useState } from 'react';

const SAMPLE_NAME = 'PolicyClaim-21.png';
const SAMPLE_URL = `/${SAMPLE_NAME}`;

function readAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function App() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [status, setStatus] = useState({ type: 'idle' });
  const [sampleAvailable, setSampleAvailable] = useState(true);
  const [isSample, setIsSample] = useState(false);
  const inputRef = useRef(null);
  const sampleRef = useRef(null);

  const selectSample = useCallback(async () => {
    try {
      if (!sampleRef.current) {
        const response = await fetch(SAMPLE_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        sampleRef.current = new File([blob], SAMPLE_NAME, { type: 'image/png' });
      }
      setFile(sampleRef.current);
      setIsSample(true);
      if (inputRef.current) inputRef.current.value = '';
    } catch {
      setSampleAvailable(false);
    }
  }, []);

  useEffect(() => {
    selectSample();
  }, [selectSample]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function handleFileChange(event) {
    const selected = event.target.files?.[0] ?? null;
    if (!selected) return;
    setStatus({ type: 'idle' });
    if (selected.type !== 'image/png') {
      setStatus({ type: 'error', message: 'Please select a .png file.' });
      event.target.value = '';
      return;
    }
    setFile(selected);
    setIsSample(false);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!file) return;

    setStatus({ type: 'submitting' });
    try {
      const fileContent = await readAsBase64(file);
      const response = await fetch('/api/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, contentType: file.type, fileContent }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || `Request failed with status ${response.status}`);
      }
      setStatus({ type: 'success', runId: result.runId });
      // Reset to the sample so the demo can be repeated straight away.
      await selectSample();
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    }
  }

  const submitting = status.type === 'submitting';

  return (
    <main className="container">
      <h1>Insurance Claim Processor</h1>
      <p className="subtitle">Upload a scanned claim form (.png) to start claim processing.</p>

      <form onSubmit={handleSubmit} className="card">
        <label htmlFor="claim-file" className="label">Claim document</label>
        <input
          id="claim-file"
          ref={inputRef}
          type="file"
          accept=".png,image/png"
          onChange={handleFileChange}
          disabled={submitting}
        />

        {sampleAvailable && (
          <div className="hint">
            {isSample ? (
              <span>
                Using the <strong>sample claim form</strong> ({SAMPLE_NAME}) by default. Choose a
                file above to submit your own instead.
              </span>
            ) : (
              <>
                <span>No claim form handy?</span>
                <button type="button" className="link-button" onClick={selectSample} disabled={submitting}>
                  Use the sample claim form
                </button>
              </>
            )}
          </div>
        )}

        {file && previewUrl && (
          <figure className="preview">
            <img src={previewUrl} alt="Selected claim document preview" />
            <figcaption>
              {file.name} ({(file.size / 1024).toFixed(1)} KB)
              {isSample && <span className="badge">Sample</span>}
            </figcaption>
          </figure>
        )}

        <button type="submit" disabled={!file || submitting}>
          {submitting ? 'Submitting…' : 'Submit'}
        </button>

        {status.type === 'success' && (
          <p className="message success" role="status">
            Claim submitted successfully.
            {status.runId && <> Run ID: <code>{status.runId}</code></>}
          </p>
        )}
        {status.type === 'error' && (
          <p className="message error" role="alert">{status.message}</p>
        )}
      </form>
    </main>
  );
}
