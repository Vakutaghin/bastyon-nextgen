import * as script_1 from './script.js';
import * as multisig from './templates/multisig/index.js';
import * as nullData from './templates/nulldata/index.js';
import * as pubKey from './templates/pubkey/index.js';
import * as pubKeyHash from './templates/pubkeyhash/index.js';
import * as scriptHash from './templates/scripthash/index.js';
import * as htlc from './templates/htlc/index.js';
import * as witnessCommitment from './templates/witnesscommitment/index.js';
import * as witnessPubKeyHash from './templates/witnesspubkeyhash/index.js';
import * as witnessScriptHash from './templates/witnessscripthash/index.js';

export const types = {
  P2MS: 'multisig',
  NONSTANDARD: 'nonstandard',
  NULLDATA: 'nulldata',
  P2PK: 'pubkey',
  P2PKH: 'pubkeyhash',
  HTLC: 'htlc',
  P2SH: 'scripthash',
  P2WPKH: 'witnesspubkeyhash',
  P2WSH: 'witnessscripthash',
  WITNESS_COMMITMENT: 'witnesscommitment',
};

export function output(script) {
  if (witnessPubKeyHash.output.check(script)) return types.P2WPKH;
  if (witnessScriptHash.output.check(script)) return types.P2WSH;
  if (pubKeyHash.output.check(script)) return types.P2PKH;
  if (scriptHash.output.check(script)) return types.P2SH;
  if (htlc.output.check(script)) return types.HTLC;
  // XXX: optimization, below functions .decompile before use
  const chunks = script_1.decompile(script);
  if (!chunks) throw new TypeError('Invalid script');
  if (multisig.output.check(chunks)) return types.P2MS;
  if (pubKey.output.check(chunks)) return types.P2PK;
  if (witnessCommitment.output.check(chunks)) return types.WITNESS_COMMITMENT;
  if (nullData.output.check(chunks)) return types.NULLDATA;
  return types.NONSTANDARD;
}

export function input(script, allowIncomplete) {
  // XXX: optimization, below functions .decompile before use
  const chunks = script_1.decompile(script);
  if (!chunks) throw new TypeError('Invalid script');
  if (pubKeyHash.input.check(chunks)) return types.P2PKH;
  if (scriptHash.input.check(chunks, allowIncomplete)) return types.P2SH;
  if (htlc.input.check(chunks, allowIncomplete)) return types.HTLC;
  if (multisig.input.check(chunks, allowIncomplete)) return types.P2MS;
  if (pubKey.input.check(chunks)) return types.P2PK;
  return types.NONSTANDARD;
}

export function witness(script, allowIncomplete) {
  // XXX: optimization, below functions .decompile before use
  const chunks = script_1.decompile(script);
  if (!chunks) throw new TypeError('Invalid script');
  if (witnessPubKeyHash.input.check(chunks)) return types.P2WPKH;
  if (witnessScriptHash.input.check(chunks, allowIncomplete))
    return types.P2WSH;
  return types.NONSTANDARD;
}
