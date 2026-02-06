import * as bscript from '../../script.js';

export function check(script) {
  const buffer = bscript.compile(script);
  return (
    buffer.length === 22 &&
    buffer[0] === bscript.OPS.OP_0 &&
    buffer[1] === 0x14
  );
}
check.toJSON = () => {
  return 'Witness pubKeyHash output';
};
