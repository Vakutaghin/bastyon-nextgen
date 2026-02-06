import * as bscript from '../../script.js';
import * as types from '../../types.js';

const OP_INT_BASE = bscript.OPS.OP_RESERVED; // OP_1 - 1

export function check(script, allowIncomplete) {
  const chunks = bscript.decompile(script);
  if (chunks.length < 4) return false;
  if (chunks[chunks.length - 1] !== bscript.OPS.OP_CHECKMULTISIG) return false;
  if (!types.Number(chunks[0])) return false;
  if (!types.Number(chunks[chunks.length - 2])) return false;
  const m = chunks[0] - OP_INT_BASE;
  const n = chunks[chunks.length - 2] - OP_INT_BASE;
  if (m <= 0) return false;
  if (n > 16) return false;
  if (m > n) return false;
  if (n !== chunks.length - 3) return false;
  if (allowIncomplete) return true;
  const keys = chunks.slice(1, -2);
  return keys.every(bscript.isCanonicalPubKey);
}
check.toJSON = () => {
  return 'multi-sig output';
};
