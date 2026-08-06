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

  // Объектная форма (TxbSignArg) — предпочтительна в bitcoinjs-lib v5+;
  // позиционная форма выдаёт DEPRECATED-варнинг. Для p2pkh `prevOutScript`
  // не нужен: builder берёт scriptPubKey из addInput.
  sign(options: {
    prevOutScriptType: string;
    vin: number;
    keyPair: ECPairInterface;
    prevOutScript?: Buffer;
    redeemScript?: Buffer;
    witnessValue?: number;
    witnessScript?: Buffer;
    hashType?: number;
  }): void;
}
