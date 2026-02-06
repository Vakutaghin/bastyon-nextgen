import * as bip39Module from 'bip39russian';
const bip39 = bip39Module.default || bip39Module;
import * as address from './modules/address.js';
import * as crypto from './modules/crypto.js';
import * as ECPair from './modules/ecpair.js';
import * as networks from './modules/networks.js';
import * as payments from './modules/payments/index.js';
import * as script from './modules/script.js';
import ecc from './modules/ecc_helper.js';
import { BIP32Factory } from 'bip32';
import { Block } from './modules/block.js';
import { Psbt } from './modules/psbt.js';
import { Transaction } from './modules/transaction.js';
import { TransactionBuilder } from './modules/transaction_builder.js';
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

if (typeof window !== 'undefined') {
  window.pocketnetBitcoin = bitcoin;
}

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
