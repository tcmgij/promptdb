/* js/utils/exportImport.js */

export function exportToJSON(prompts, tags) {
  const payload = {
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    prompts,
    tags,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');

  const date = new Date().toISOString().slice(0, 10);
  a.href     = url;
  a.download = `gp-prompts-backup-${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function readJSONFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => {
      try {
        const data = JSON.parse(e.target.result);
        resolve(data);
      } catch {
        reject(new Error('Invalid JSON file — could not parse.'));
      }
    };
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.readAsText(file);
  });
}

export function validateImport(data) {
  if (!data || typeof data !== 'object') throw new Error('Invalid file format.');
  if (data.exportVersion !== 1) throw new Error('Unsupported backup version.');
  if (!Array.isArray(data.prompts)) throw new Error('Missing prompts array.');
  if (!Array.isArray(data.tags))    throw new Error('Missing tags array.');

  for (const p of data.prompts) {
    if (!p.id || !p.title || !p.promptText) {
      throw new Error('One or more prompts are missing required fields (id, title, promptText).');
    }
  }

  return true;
}
