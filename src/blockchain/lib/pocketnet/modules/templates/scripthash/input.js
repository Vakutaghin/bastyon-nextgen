import * as bscript from '../../script.js';
import * as p2ms from '../multisig/index.js';
import * as p2pk from '../pubkey/index.js';
import * as p2pkh from '../pubkeyhash/index.js';
import * as p2wpkho from '../witnesspubkeyhash/output.js';
import * as p2wsho from '../witnessscripthash/output.js';
import { Buffer } from 'buffer';

export function check(script, allowIncomplete) {
  const chunks = bscript.decompile(script);
  if (chunks.length < 1) return false;
  const lastChunk = chunks[chunks.length - 1];
  if (!Buffer.isBuffer(lastChunk)) return false;
  const scriptSigChunks = bscript.decompile(
    bscript.compile(chunks.slice(0, -1)),
  );
  const redeemScriptChunks = bscript.decompile(lastChunk);
  if (!redeemScriptChunks) return false;
  if (!bscript.isPushOnly(scriptSigChunks)) return false;
  if (chunks.length === 1) {
    return (
      p2wsho.check(redeemScriptChunks) || p2wpkho.check(redeemScriptChunks)
    );
  }
  if (
    p2pkh.input.check(scriptSigChunks) &&
    p2pkh.output.check(redeemScriptChunks)
  )
    return true;
  if (
    p2ms.input.check(scriptSigChunks, allowIncomplete) &&
    p2ms.output.check(redeemScriptChunks)
  )
    return true;
  if (
    p2pk.input.check(scriptSigChunks) &&
    p2pk.output.check(redeemScriptChunks)
  )
    return true;
  return false;
}
check.toJSON = () => {
  return 'scriptHash input';
};
