import * as bscript from '../../script.js';

export function check(script) {
  const buffer = bscript.compile(script);
  return (
    buffer.length === 93 &&
    buffer[1] === bscript.OPS.OP_IF &&
    buffer[2] === bscript.OPS.OP_SHA256 &&
    buffer[3] === 0x20 &&
    buffer[36] === bscript.OPS.OP_EQUALVERIFY &&
    buffer[37] === bscript.OPS.OP_DUP &&
    buffer[38] === bscript.OPS.OP_HASH160 &&
    buffer[39] === 0x14 &&
    buffer[60] === bscript.OPS.OP_ELSE &&
    buffer[61] === 0x3 &&
    buffer[65] === bscript.OPS.OP_CHECKLOCKTIMEVERIFY &&
    buffer[66] === bscript.OPS.OP_DROP &&
    buffer[67] === bscript.OPS.OP_DUP &&
    buffer[68] === bscript.OPS.OP_HASH160 &&
    buffer[69] === 0x14 &&
    buffer[90] === bscript.OPS.OP_ENDIF &&
    buffer[91] === bscript.OPS.OP_EQUALVERIFY &&
    buffer[92] === bscript.OPS.OP_CHECKSIG
  );
}
check.toJSON = () => {
  return 'htlc output';
};
