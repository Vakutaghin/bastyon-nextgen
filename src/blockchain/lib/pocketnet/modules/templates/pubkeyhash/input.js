import * as bscript from '../../script.js';

export function check(script) {
  const chunks = bscript.decompile(script);
  return (
    chunks.length === 2 &&
    bscript.isCanonicalScriptSignature(chunks[0]) &&
    bscript.isCanonicalPubKey(chunks[1])
  );
}
check.toJSON = () => {
  return 'pubKeyHash input';
};
