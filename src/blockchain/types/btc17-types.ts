import type { ECPairInterface } from 'ecpair';

export interface Network {
  messagePrefix: string;
  bech32: string;
  bip32: {
    public: number;
    private: number;
  };
  pubKeyHash: number;
  scriptHash: number;
  wif: number;
}

export interface TransactionBuilder {
  sign(
    inputIndex: number,
    keyPair: ECPairInterface,
    redeemScript?: Buffer,
    hashType?: number,
    witnessValue?: number,
    witnessScript?: Buffer
  ): void;

  sign(options: {
    prevOutScript: Buffer;
    prevOutScriptType: string;
    vin: number;
    keyPair: ECPairInterface;
    witnessValue?: number;
    witnessScript?: Buffer;
    hashType?: number;
  }): void;
}
