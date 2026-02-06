import * as bscript from '../../script.js';
import * as types from '../../types.js';
import typeforce from 'typeforce';
import { Buffer } from 'buffer';

const HEADER = Buffer.from('aa21a9ed', 'hex');

export function check(script) {
  const buffer = bscript.compile(script);
  return (
    buffer.length > 37 &&
    buffer[0] === bscript.OPS.OP_RETURN &&
    buffer[1] === 0x24 &&
    buffer.slice(2, 6).equals(HEADER)
  );
}
check.toJSON = () => {
  return 'Witness commitment output';
};
export function encode(commitment) {
  typeforce(types.Hash256bit, commitment);
  const buffer = Buffer.allocUnsafe(36);
  HEADER.copy(buffer, 0);
  commitment.copy(buffer, 4);
  return bscript.compile([bscript.OPS.OP_RETURN, buffer]);
}
export function decode(buffer) {
  typeforce(check, buffer);
  return bscript.decompile(buffer)[1].slice(4, 36);
}
