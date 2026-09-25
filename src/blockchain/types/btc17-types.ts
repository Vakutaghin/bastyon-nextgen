export interface Network {
  messagePrefix: string
  bech32: string
  bip32: {
    public: number
    private: number
  }
  pubKeyHash: number
  scriptHash: number
  wif: number
}
