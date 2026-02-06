import * as bip39Module from 'bip39russian';
const bip39 = bip39Module.default || bip39Module;
import * as address from './address.js';
import * as crypto from './crypto.js';
import * as ECPair from './ecpair.js';
import * as networks from './networks.js';
import * as payments from './payments/index.js';
import * as script from './script.js';
import ecc from './ecc_helper.js';
import { BIP32Factory } from 'bip32';
import { Block } from './block.js';
import { Psbt } from './psbt.js';
import { Transaction } from './transaction.js';
import { TransactionBuilder } from './transaction_builder.js';
import * as randomBytesModule from 'randombytes';
const randomBytes = randomBytesModule.default || randomBytesModule;

const bip32 = BIP32Factory(ecc);
const opcodes = script.OPS;

function makeRandom(size) {
  return randomBytes(size);
}

const bitcoin = {
  bip32,
  bip39,
  address,
  crypto,
  ECPair,
  networks,
  payments,
  script,
  ecc,
  Block,
  Psbt,
  opcodes,
  Transaction,
  TransactionBuilder,
  makeRandom
};

export {
  bip32,
  bip39,
  address,
  crypto,
  ECPair,
  networks,
  payments,
  script,
  ecc,
  Block,
  Psbt,
  opcodes,
  Transaction,
  TransactionBuilder,
  makeRandom
};

export default bitcoin;
