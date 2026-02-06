import * as bscript from '../../script.js';

export function check(script) {
  const buffer = bscript.compile(script);
  return (
    buffer.length === 23 &&
    buffer[0] === bscript.OPS.OP_HASH160 &&
    buffer[1] === 0x14 &&
    buffer[22] === bscript.OPS.OP_EQUAL
  );
}
check.toJSON = () => {
  return 'scriptHash output';
};
