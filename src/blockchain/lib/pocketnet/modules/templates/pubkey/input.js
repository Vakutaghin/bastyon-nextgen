import * as bscript from '../../script.js';

export function check(script) {
  const chunks = bscript.decompile(script);
  return chunks.length === 1 && bscript.isCanonicalScriptSignature(chunks[0]);
}
check.toJSON = () => {
  return 'pubKey input';
};
