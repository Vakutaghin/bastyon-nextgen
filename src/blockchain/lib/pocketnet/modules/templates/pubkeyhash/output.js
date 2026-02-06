import * as bscript from '../../script.js';

export function check(script) {
  const buffer = bscript.compile(script);
  return (
    buffer.length === 25 &&
    buffer[0] === bscript.OPS.OP_DUP &&
    buffer[1] === bscript.OPS.OP_HASH160 &&
    buffer[2] === 0x14 &&
    buffer[23] === bscript.OPS.OP_EQUALVERIFY &&
    buffer[24] === bscript.OPS.OP_CHECKSIG
  );
}
check.toJSON = () => {
  return 'pubKeyHash output';
};
