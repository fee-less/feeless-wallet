import { useState, useEffect, useRef } from "react";
import {
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  Alert,
  CircularProgress,
  Link,
  Popper,
} from "@mui/material";
import { randomKeyPair } from "feeless-utils";
import { saveWalletCredentials } from "../utils/storage";

interface LoginScreenProps {
  onLogin: (privateKey: string, wsNode: string, httpNode: string) => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [privateKey, setPrivateKey] = useState("");
  const [showWalletPopper, setShowWalletPopper] = useState(false);
  const popperAnchorRef = useRef<HTMLButtonElement | null>(null);
  const [wsNode, setWsNode] = useState("ws://localhost:6061");
  const [httpNode, setHttpNode] = useState("http://localhost:8000");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("wallet_credentials");
    if (stored) {
      try {
        const { privateKey, wsNode, httpNode } = JSON.parse(stored);
        setPrivateKey(privateKey);
        setWsNode(wsNode);
        setHttpNode(httpNode);
      } catch {
        // Invalid stored data, ignore
      }
    }
  }, []);

  const handleGenerateWallet = () => {
    const { priv } = randomKeyPair();
    setPrivateKey(priv);
    setShowWalletPopper(true);
    setError(null);
  };

  const handleLogin = async () => {
    if (!privateKey || !wsNode || !httpNode) {
      setError("Please fill in all fields");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Save credentials
      saveWalletCredentials({ privateKey, wsNode, httpNode });

      // Attempt login
      onLogin(privateKey, wsNode, httpNode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 400, mx: "auto", mt: 4, position: "relative" }}>
      <Popper
        open={showWalletPopper}
        anchorEl={popperAnchorRef.current}
        placement="bottom"
        style={{ zIndex: 1300 }}
        transition
        sx={{ position: "absolute", top: 0, left: 0, width: "100vw" }}
      >
        <Paper sx={{ p: 3, minWidth: 320, textAlign: "center" }}>
          <Typography
            variant="subtitle1"
            color="primary"
            gutterBottom
            fontWeight={600}
          >
            New Wallet Generated!
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
            Your private key:
          </Typography>
          <Paper
            sx={{
              p: 1,
              mb: 2,
              wordBreak: "break-all",
              fontFamily: "monospace",
              fontSize: 15,
            }}
            elevation={0}
          >
            {privateKey}
          </Paper>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            <b>Keep this private key safe!</b> Never share it with anyone. You
            will need it to access your wallet. <br />
            No one can recover it for you if lost.
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={() => setShowWalletPopper(false)}
          >
            Got it
          </Button>
        </Paper>
      </Popper>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom align="center">
          Feeless Wallet Login
        </Typography>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <TextField
            label="Private Key"
            value={privateKey}
            onChange={(e) => setPrivateKey(e.target.value)}
            fullWidth
            margin="normal"
          />
          <TextField
            label="WebSocket Node"
            value={wsNode}
            onChange={(e) => setWsNode(e.target.value)}
            fullWidth
            margin="normal"
          />
          <TextField
            label="HTTP Node"
            value={httpNode}
            onChange={(e) => setHttpNode(e.target.value)}
            fullWidth
            margin="normal"
          />

          <Button
            variant="contained"
            onClick={handleGenerateWallet}
            ref={popperAnchorRef}
            sx={{ fontWeight: 600, borderRadius: 2 }}
          >
            Generate New Wallet
          </Button>
          <Button
            variant="contained"
            onClick={handleLogin}
            disabled={!privateKey || !wsNode || !httpNode || loading}
          >
            {loading ? <CircularProgress size={24} /> : "Login"}
          </Button>
          <Link
            href="https://fee-less.com/host-how"
            target="_blank"
            rel="noopener noreferrer"
            textAlign="center"
          >
            Learn how to host your node
          </Link>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </Paper>
    </Box>
  );
}
