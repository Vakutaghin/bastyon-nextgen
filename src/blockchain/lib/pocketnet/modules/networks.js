// @ts-ignore
export const bitcoin =
  (typeof process !== 'undefined' &&
    process.argv &&
    process.argv.includes &&
    process.argv.includes('--test')) ||
  (typeof window !== 'undefined' && window.testpocketnet)
    ? {
        messagePrefix: '\x18Bitcoin Signed Message:\n',
        bech32: 'bc',
        bip32: {
          public: 0x043587cf,
          private: 0x04358394,
        },
        pubKeyHash: 0x41,
        scriptHash: 0x4e,
        wif: 0x1e,
      }
    : {
        messagePrefix: '\x18Bitcoin Signed Message:\n',
        bech32: 'bc',
        bip32: {
          public: 0x043587cf,
          private: 0x04358394,
        },
        pubKeyHash: 0x37,
        scriptHash: 0x50,
        wif: 0x21,
      };
