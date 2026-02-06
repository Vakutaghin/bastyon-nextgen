import * as bscript from '../../script.js';

function partialSignature(value) {
  return (
    value === bscript.OPS.OP_0 || bscript.isCanonicalScriptSignature(value)
  );
}
export function check(script, allowIncomplete) {
  const chunks = bscript.decompile(script);
  if (chunks.length < 2) return false;
  if (chunks[0] !== bscript.OPS.OP_0) return false;
  if (allowIncomplete) {
    return chunks.slice(1).every(partialSignature);
  }
  return chunks.slice(1).every(bscript.isCanonicalScriptSignature);
}
check.toJSON = () => {
  return 'multisig input';
};
