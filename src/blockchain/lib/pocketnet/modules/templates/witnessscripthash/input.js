import * as bscript from '../../script.js';
import typeforce from 'typeforce';
import * as p2ms from '../multisig/index.js';
import * as p2pk from '../pubkey/index.js';
import * as p2pkh from '../pubkeyhash/index.js';
import { Buffer } from 'buffer';

export function check(chunks, allowIncomplete) {
  typeforce(typeforce.Array, chunks);
  if (chunks.length < 1) return false;
  const witnessScript = chunks[chunks.length - 1];
  if (!Buffer.isBuffer(witnessScript)) return false;
  const witnessScriptChunks = bscript.decompile(witnessScript);
  if (!witnessScriptChunks || witnessScriptChunks.length === 0) return false;
  const witnessRawScriptSig = bscript.compile(chunks.slice(0, -1));
  if (
    p2pkh.input.check(witnessRawScriptSig) &&
    p2pkh.output.check(witnessScriptChunks)
  )
    return true;
  if (
    p2ms.input.check(witnessRawScriptSig, allowIncomplete) &&
    p2ms.output.check(witnessScriptChunks)
  )
    return true;
  if (
    p2pk.input.check(witnessRawScriptSig) &&
    p2pk.output.check(witnessScriptChunks)
  )
    return true;
  return false;
}
check.toJSON = () => {
  return 'witnessScriptHash input';
};
