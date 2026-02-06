import { bitcoin as BITCOIN_NETWORK } from '../networks.js';
import * as bscript from '../script.js';
import * as lazy from './lazy.js';
import * as typeforceModule from 'typeforce';
const typeforce = typeforceModule.default || typeforceModule;
import { Buffer } from 'buffer';

const OPS = bscript.OPS;

// typeforce helper
function typef(types, value) {
    return typeforce(types, value);
}
typef.maybe = typeforce.maybe;
typef.Object = typeforce.Object;
typef.arrayOf = typeforce.arrayOf;
typef.Buffer = typeforce.Buffer;

function stacksEqual(a, b) {
  if (a.length !== b.length) return false;
  return a.every((x, i) => {
    return x.equals(b[i]);
  });
}

export function embed(a, opts) {
  if (!a.data && !a.output) throw new TypeError('Not enough data');
  opts = Object.assign({ validate: true }, opts || {});
  typef(
    {
      network: typef.maybe(typef.Object),
      output: typef.maybe(typef.Buffer),
      data: typef.maybe(typef.arrayOf(typef.Buffer)),
    },
    a,
  );
  const network = a.network || BITCOIN_NETWORK;
  const o = { name: 'embed', network };
  lazy.prop(o, 'output', () => {
    if (!a.data) return;
    return bscript.compile([OPS.OP_RETURN].concat(a.data));
  });
  lazy.prop(o, 'data', () => {
    if (!a.output) return;
    return bscript.decompile(a.output).slice(1);
  });
  // extended validation
  if (opts.validate) {
    if (a.output) {
      const chunks = bscript.decompile(a.output);
      if (chunks[0] !== OPS.OP_RETURN) throw new TypeError('Output is invalid');
      if (!chunks.slice(1).every(typef.Buffer))
        throw new TypeError('Output is invalid');
      if (a.data && !stacksEqual(a.data, o.data))
        throw new TypeError('Data mismatch');
    }
  }
  return Object.assign(o, a);
}
