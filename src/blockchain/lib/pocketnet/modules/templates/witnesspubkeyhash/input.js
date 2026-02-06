import * as bscript from '../../script.js';

function isCompressedCanonicalPubKey(pubKey) {
  return bscript.isCanonicalPubKey(pubKey) && pubKey.length === 33;
}
export function check(script) {
  const chunks = bscript.decompile(script);
  return (
    chunks.length === 2 &&
    bscript.isCanonicalScriptSignature(chunks[0]) &&
    isCompressedCanonicalPubKey(chunks[1])
  );
}
check.toJSON = () => {
  return 'witnessPubKeyHash input';
};
