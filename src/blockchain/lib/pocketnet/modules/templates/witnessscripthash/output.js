import * as bscript from '../../script.js';

export function check(script) {
  const buffer = bscript.compile(script);
  return (
    buffer.length === 34 &&
    buffer[0] === bscript.OPS.OP_0 &&
    buffer[1] === 0x20
  );
}
check.toJSON = () => {
  return 'Witness scriptHash output';
};
