import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import { FeelessClient, fPointsToFLSS } from 'feeless-utils';

// Types for actions
export type WalletActionRequest =
  | { type: "getPublicKey"; id?: string }
  | { type: "sharePublicKey"; id?: string }
  | { type: "signMessage"; message: string; id?: string }
  | { type: "signIn"; nonce: number; id?: string }
  | { type: "send"; amount: number; to: string; token?: string; unlock?: number; id?: string }
  | { type: "mintToken"; airdrop: number; miningReward?: number; token: string; id?: string }
  | { type: "alive"; id?: string };

interface ModalContextType {
  requestAction: (action: WalletActionRequest) => Promise<any>;
}

declare global {
  interface Window {
    chrome?: any;
    __feelessSendResponse?: any;
  }
}

const WalletActionModalContext = createContext<ModalContextType | undefined>(undefined);

export function useWalletActionModal() {
  const ctx = useContext(WalletActionModalContext);
  if (!ctx) throw new Error('Must be used within WalletActionModalProvider');
  return ctx;
}

export function WalletActionModalProvider({ children, client }: { children: ReactNode; client: FeelessClient }) {
  const [modal, setModal] = useState<
    | {
        action: WalletActionRequest;
        resolve?: (value: any) => void;
        reject?: (reason?: any) => void;
        external?: boolean;
        requestId?: string;
      }
    | null
  >(null);
  const [showCodeBox, setShowCodeBox] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [mintFee, setMintFee] = useState(0);

  // Listen for direct panel requests from background
  useEffect(() => {
    if (window.chrome && window.chrome.runtime && window.chrome.runtime.onMessage) {
      function handlePanelRequest(request: any) {
        if (request && request.type === 'feeless-wallet-panel-request') {
          if (!client) return; // Only prompt if logged in
          if (request.method === 'alive') {
            window.chrome?.runtime?.sendMessage({
              type: 'feeless-wallet-panel-response',
              requestId: request.requestId,
              result: { status: 'alive' },
            });
            return;
          }
          if (request.method === "getPublicKey") {
            setModal({
              action: { type: "getPublicKey" },
              external: true,
              requestId: request.requestId,
            });
          } else if (request.method === "signMessage") {
            setModal({
              action: { type: "signMessage", message: request.payload.message },
              external: true,
              requestId: request.requestId,
            });
          } else if (request.method === "signIn") {
            setModal({
              action: { type: "signIn", nonce: request.payload.nonce },
              external: true,
              requestId: request.requestId,
            });
          } else if (request.method === "send") {
            setModal({
              action: {
                type: "send",
                amount: request.payload.amount,
                to: request.payload.to,
                token: request.payload.token,
              },
              external: true,
              requestId: request.requestId,
            });
          } else if (request.method === "mintToken") {
            setModal({
              action: {
                type: "mintToken",
                airdrop: request.payload.airdrop,
                miningReward: request.payload.miningReward,
                token: request.payload.token,
              },
              external: true,
              requestId: request.requestId,
            });
            client.getMintFee().then(mf => setMintFee(mf));
          }
        }
      }
      window.chrome.runtime.onMessage.addListener(handlePanelRequest);
      return () => window.chrome.runtime.onMessage.removeListener(handlePanelRequest);
    }
  }, [client]);

  // Countdown timer effect to auto-close modal after 10 seconds
  useEffect(() => {
    if (!modal) {
      setCountdown(10); // reset countdown when modal closes
      return;
    }

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleReject(); // auto reject/close modal after countdown ends
          return 10; // reset for next time
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [modal]);

  const requestAction = (action: WalletActionRequest) => {
    return new Promise((resolve, reject) => {
      setModal({ action, resolve, reject, external: false });
    });
  };

  const handleApprove = async () => {
    if (!modal) return;
    let result;
    if (modal.action.type === "getPublicKey") {
      result = client ? { publicKey: client.getPublic() } : undefined;
    } else if (modal.action.type === "sharePublicKey") {
      result = client ? { publicKey: client.getPublic() } : undefined;
    } else if (modal.action.type === "signMessage") {
      result = client
        ? {
            publicKey: client.getPublic(),
            signature: client.signMessage(modal.action.message),
          }
        : undefined;
    } else if (modal.action.type === "signIn") {
      result = client
        ? {
            publicKey: client.getPublic(),
            signature: client.signMessage(String(modal.action.nonce)),
          }
        : undefined;
    } else if (modal.action.type === "send") {
      if (!client) return (result = undefined);

      const sign = await client.placeTXV2(
        modal.action.to,
        modal.action.amount,
        modal.action.token,
        modal.action.unlock
      );

      result = {
        status: sign ? "success" : "fail",
        publicKey: client.getPublic(),
        signature: sign ?? undefined,
      };
    } else if (modal.action.type === "mintToken") {
      if (!client) return (result = undefined);

      const res = await client.mintToken({
        airdrop: modal.action.airdrop,
        miningReward: modal.action.miningReward ?? undefined,
        token: modal.action.token,
      });

      result = {
        status: res ? "success" : "fail",
        publicKey: client.getPublic(),
      };
    }
    if (modal.external && modal.requestId) {
      window.chrome?.runtime?.sendMessage({
        type: 'feeless-wallet-panel-response',
        requestId: modal.requestId,
        result,
      });
    } else if (modal.external && modal.action.id) {
      window.chrome?.runtime?.sendMessage({
        type: 'feeless-wallet-response',
        id: modal.action.id,
        result,
      });
    } else if (modal.resolve) {
      modal.resolve(result);
    }
    setModal(null);
  };

  const handleReject = () => {
    if (!modal) return;
    if (modal.external && modal.requestId) {
      window.chrome?.runtime?.sendMessage({
        type: 'feeless-wallet-panel-response',
        requestId: modal.requestId,
        error: 'User denied',
      });
    } else if (modal.external && modal.action.id) {
      window.chrome?.runtime?.sendMessage({
        type: 'feeless-wallet-response',
        id: modal.action.id,
        error: 'User denied',
      });
    } else if (modal.reject) {
      modal.reject('User denied');
    }
    setModal(null);
  };

  // Render modal content based on action
  const renderModalContent = () => {
    if (!modal) return null;
    const { action } = modal;
    switch (action.type) {
      case "getPublicKey":
        return (
          <>
            <DialogTitle>Share Public Key</DialogTitle>
            <DialogContent>
              <Typography>
                Do you want to share your public key with the requesting site?
              </Typography>
            </DialogContent>
          </>
        );
      case "sharePublicKey":
        return (
          <>
            <DialogTitle>Share Public Key</DialogTitle>
            <DialogContent>
              <Typography>
                Do you want to share your public key with the requesting site?
              </Typography>
            </DialogContent>
          </>
        );
      case "signMessage":
        return (
          <>
            <DialogTitle>Sign Message</DialogTitle>
            <DialogContent>
              <Typography sx={{ mb: 1 }}>
                You are about to sign a message for this dapp. Only sign if you
                trust the dapp.
              </Typography>
              <Button
                variant="outlined"
                sx={{ mb: 1 }}
                onClick={() => setShowCodeBox((v) => !v)}
              >
                {showCodeBox ? "Hide" : "Show"} Message
              </Button>
              {showCodeBox && (
                <Typography
                  sx={{
                    mt: 2,
                    fontFamily: "monospace",
                    bgcolor: "action.hover",
                    p: 1,
                    borderRadius: 1,
                    maxHeight: 250,
                    overflowY: "auto",
                    wordBreak: "break-all",
                    overflowWrap: "anywhere",
                  }}
                >
                  {action.message}
                </Typography>
              )}
            </DialogContent>
          </>
        );
      case "signIn":
        return (
          <>
            <DialogTitle>Sign In to Dapp</DialogTitle>
            <DialogContent>
              <Typography sx={{ mb: 1 }}>
                Signing in is completely safe. The dapp cannot access your
                funds. You are signing the integer: <b>{action.nonce}</b>
              </Typography>
            </DialogContent>
          </>
        );
      case "send":
        return (
          <>
            <DialogTitle>Send Transaction</DialogTitle>
            <DialogContent>
              <Typography>
                Do you want to send {action.amount} {action.token || "FLSS"} to:
              </Typography>
              <Typography
                sx={{
                  mt: 2,
                  fontFamily: "monospace",
                  bgcolor: "action.hover",
                  p: 1,
                  borderRadius: 1,
                  maxHeight: 250,
                  overflowY: "auto",
                  wordBreak: "break-all",
                  overflowWrap: "anywhere",
                }}
              >
                {action.to}
              </Typography>
            </DialogContent>
          </>
        );
      case "mintToken":
        return (
          <>
            <DialogTitle>Send Transaction</DialogTitle>
            <DialogContent>
              <Typography>Do you want to mint {action.token}?</Typography>
              <Typography>Estimated fee {fPointsToFLSS(mintFee)}FLSS (may vary slightly)</Typography>
            </DialogContent>
          </>
        );
    }
  };

  return (
    <WalletActionModalContext.Provider value={{ requestAction }}>
      {children}
      <Dialog open={!!modal} onClose={handleReject} maxWidth="xs" fullWidth>
        {renderModalContent()}
        <DialogActions
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Circular countdown */}
          <Box sx={{ position: 'relative', display: 'inline-flex', mr: 2 }}>
            <CircularProgress variant="determinate" value={(countdown / 10) * 100} />
            <Box
              sx={{
                top: 0,
                left: 0,
                bottom: 0,
                right: 0,
                position: 'absolute',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                userSelect: 'none',
              }}
            >
              {countdown}
            </Box>
          </Box>

          <Box sx={{ ml: 'auto' }}>
            <Button onClick={handleReject} color="secondary">
              Reject
            </Button>
            <Button onClick={handleApprove} color="primary" variant="contained" sx={{ ml: 1 }}>
              Approve
            </Button>
          </Box>
        </DialogActions>
      </Dialog>
    </WalletActionModalContext.Provider>
  );
}
