import * as bscript from '../../script.js';

export function check(script) {
  const chunks = bscript.decompile(script);
  return (
    chunks.length === 2 &&
    bscript.isCanonicalPubKey(chunks[0]) &&
    chunks[1] === bscript.OPS.OP_CHECKSIG
  );
}
check.toJSON = () => {
  return 'pubKey output';
};
