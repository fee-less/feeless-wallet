interface WalletCredentials {
  privateKey: string;
  wsNode: string;
  httpNode: string;
}

export const saveWalletCredentials = (credentials: WalletCredentials) => {
  localStorage.setItem('wallet_credentials', JSON.stringify(credentials));
};

export const getWalletCredentials = (): WalletCredentials | null => {
  const stored = localStorage.getItem('wallet_credentials');
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
};

export const clearWalletCredentials = () => {
  localStorage.removeItem('wallet_credentials');
}; 