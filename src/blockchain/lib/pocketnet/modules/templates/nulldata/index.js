import * as bscript from '../../script.js';

const OPS = bscript.OPS;

function check(script) {
  const buffer = bscript.compile(script);
  return buffer.length > 1 && buffer[0] === OPS.OP_RETURN;
}
check.toJSON = () => {
  return 'null data output';
};
const output = { check };
export { output };
