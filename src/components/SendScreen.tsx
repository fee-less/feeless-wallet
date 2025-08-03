import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  Alert,
  CircularProgress,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  IconButton,
  Tooltip,
  Dialog,
  DialogContent,
  DialogTitle,
  Switch
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import InfoIcon from "@mui/icons-material/Info";
import { FeelessClient, fPointsToFLSS, FLSStoFPoints } from 'feeless-utils';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats, Html5QrcodeScanType } from 'html5-qrcode';
import dayjs from "dayjs";

interface SendScreenProps {
  client: FeelessClient;
  onBack: () => void;
  initialToken?: string;
}

// Format large numbers with K, M, B suffixes
const formatNumber = (num: bigint | number, isToken = false): string => {
  if (isToken) {
    // For tokens, divide by 1000 to show 3 decimal places
    const tokenValue = typeof num === 'bigint' ? Number(num) / 1000 : num / 1000;
    if (tokenValue >= 1_000_000_000) return `${(tokenValue / 1_000_000_000).toFixed(3)}B`;
    if (tokenValue >= 1_000_000) return `${(tokenValue / 1_000_000).toFixed(3)}M`;
    if (tokenValue >= 1_000) return `${(tokenValue / 1_000).toFixed(3)}K`;
    return tokenValue.toLocaleString('en-US', { 
      minimumFractionDigits: 3,
      maximumFractionDigits: 3
    });
  }
  const flss = fPointsToFLSS(Number(num));
  return typeof flss === 'string' ? flss : flss.toString();
};

export function SendScreen({ client, onBack, initialToken }: SendScreenProps) {
  const [receiver, setReceiver] = useState('');
  const [amount, setAmount] = useState('');
  const [token, setToken] = useState(initialToken || 'Native FLSS');
  const [unlock, setUnlock] = useState(Date.now());
  const [useUnlock, setUseUnlock] = useState(false);
  const [percentage, setPercentage] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableTokens, setAvailableTokens] = useState<string[]>([]);
  const [balance, setBalance] = useState<bigint>(BigInt(0));
  const [showScanner, setShowScanner] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    loadTokens();
    if (initialToken) {
      setToken(initialToken);
    }
  }, [client, initialToken]);

  useEffect(() => {
    loadBalance();
  }, [token]);

  const loadTokens = async () => {
    try {
      const tokens = await client.getTokens();
      setAvailableTokens(tokens);
    } catch (err) {
      console.error('Failed to load tokens:', err);
    }
  };

  const loadBalance = async () => {
    try {
      const bal = await client.pollBalance(token === "Native FLSS" ? undefined : token);
      // Multiply by 1000 to store with 3 decimal places for tokens
      setBalance(token === "Native FLSS" ? BigInt(bal) : BigInt(bal * 1000));
    } catch (err) {
      console.error('Failed to load balance:', err);
    }
  };

  const handlePercentageChange = (_: Event, newValue: number | number[]) => {
    const percentage = newValue as number;
    setPercentage(percentage);
    if (token === 'Native FLSS') {
      const flssAmount = fPointsToFLSS(Number(balance) * percentage / 100);
      setAmount(flssAmount.toString());
      if (BigInt(FLSStoFPoints(parseFloat(flssAmount.toString()))) > balance) {
        setError('Insufficient balance');
      } else {
        setError('');
      }
    } else {
      // For tokens, calculate based on the actual balance (already multiplied by 1000)
      const tokenAmount = (balance * BigInt(percentage)) / BigInt(100);
      // Convert back to display value by dividing by 1000
      setAmount((Number(tokenAmount) / 1000).toString());
      if (tokenAmount > balance) {
        setError('Insufficient balance');
      } else {
        setError('');
      }
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAmount(value);
    
    if (!value || isNaN(Number(value))) {
      setPercentage(0);
      setError('');
      return;
    }

    let newPercentage = 0;
    
    if (token === 'Native FLSS') {
      const fpoints = FLSStoFPoints(parseFloat(value));
      newPercentage = (Number(fpoints) / Number(balance)) * 100;
      if (BigInt(fpoints) > balance) {
        setError('Insufficient balance');
      } else {
        setError('');
      }
    } else {
      // For tokens, multiply input by 1000 to match stored balance format
      const tokenAmount = Math.round(parseFloat(value) * 1000);
      if (tokenAmount > Number.MAX_SAFE_INTEGER) {
        setError('Amount exceeds maximum safe value');
        return;
      }
      // Calculate percentage based on the stored balance (already multiplied by 1000)
      newPercentage = (tokenAmount / Number(balance)) * 100;
      if (tokenAmount > Number(balance)) {
        setError('Insufficient balance');
      } else {
        setError('');
      }
    }
    
    // Round to nearest integer for the slider
    setPercentage(Math.round(newPercentage));
  };

  const handleTokenChange = async (newToken: string) => {
    const token = newToken === '' ? 'Native FLSS' : newToken;
    setToken(token);
    setAmount('');
    setPercentage(0);
    try {
      const bal = await client.pollBalance(token === "Native FLSS" ? undefined : token);
      setBalance(BigInt(bal));
    } catch (err) {
      console.error('Failed to load balance:', err);
    }
  };

  const handleSend = async () => {
    if (!receiver || !amount) {
      setError('Please fill in all required fields');
      return;
    }

    let amountInPoints: number | bigint;
    if (token !== "Native FLSS") {
      // For tokens, multiply by 1000 to store with 3 decimal places
      amountInPoints = Math.round(parseFloat(amount) * 1000);
      if (amountInPoints > Number.MAX_SAFE_INTEGER) {
        setError('Amount exceeds maximum safe value');
        return;
      }
      // Divide by 1000 when sending to node since node stores raw values
      amountInPoints = Math.round(amountInPoints / 1000);
    } else {
      // For FLSS, convert from human-readable format
      amountInPoints = FLSStoFPoints(parseFloat(amount));
    }

    // Check against total available balance (including mempool)
    if (BigInt(amountInPoints) > balance) {
      setError(`Insufficient balance. You have ${formatNumber(balance, token !== 'Native FLSS')} ${token || 'FLSS'} available`);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const success = await client.placeTX(receiver, Number(amountInPoints), token === "Native FLSS" ? undefined : token, useUnlock ? unlock : undefined);
      
      if (success) {
        setAmount('');
        setReceiver('');
        setPercentage(0);
        onBack();
      } else {
        setError('Transaction failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleScannerClose = () => {
    if (scannerRef.current) {
      scannerRef.current.clear();
      scannerRef.current = null;
    }
    setShowScanner(false);
    setScannerError(null);
  };

  useEffect(() => {
    let scanner: Html5QrcodeScanner | null = null;
    
    if (showScanner) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        try {
          scanner = new Html5QrcodeScanner(
            'qr-reader',
            {
              fps: 5,
              qrbox: { width: 300, height: 300 },
              aspectRatio: 1.0,
              showTorchButtonIfSupported: true,
              showZoomSliderIfSupported: true,
              defaultZoomValueIfSupported: 1,
              formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
              rememberLastUsedCamera: true,
              supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
            },
            false
          );

          scanner.render(
            (decodedText) => {
              try {
                if (decodedText.length >= 32 && decodedText.length <= 64) {
                  setReceiver(decodedText);
                  handleScannerClose();
                } else {
                  setScannerError('Invalid QR code format - expected a valid address');
                }
              } catch (err) {
                setScannerError('Failed to parse QR code data');
              }
            },
            (errorMessage) => {
              // Ignore errors during scanning
              console.debug(errorMessage);
            }
          );
          scannerRef.current = scanner;
        } catch (err) {
          setScannerError(`Failed to start camera: ${err instanceof Error ? err.message : String(err)}`);
        }
      }, 100);
    }

    return () => {
      if (scanner) {
        scanner.clear();
        scannerRef.current = null;
      }
    };
  }, [showScanner]);

  const renderAvailableBalance = () => (
    <Typography 
      variant="body2" 
      color="text.secondary"
      sx={{ textAlign: 'right' }}
    >
      Available: {formatNumber(balance, token !== 'Native FLSS')} {token}
    </Typography>
  );

  return (
    <Box
      sx={{
        maxWidth: 600,
        mx: "auto",
        mt: { xs: 0, sm: 4 },
        px: { xs: 1, sm: 2 },
        minHeight: "100vh",
        bgcolor: "background.default",
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, sm: 3 },
          borderRadius: { xs: 0, sm: 2 },
          minHeight: "100vh",
          bgcolor: "background.default",
        }}
      >
        <Box sx={{ mb: 3 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={onBack}
            sx={{
              mb: 2,
              textTransform: "none",
              fontWeight: "bold",
            }}
          >
            Back
          </Button>
          <Typography
            variant="h5"
            gutterBottom
            sx={{
              fontWeight: "bold",
              textAlign: "center",
            }}
          >
            Send
          </Typography>
        </Box>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <FormControl fullWidth>
            <InputLabel>Token</InputLabel>
            <Select
              value={token}
              label="Token"
              onChange={(e) => handleTokenChange(e.target.value)}
              sx={{ borderRadius: 2 }}
            >
              <MenuItem value="Native FLSS">Native FLSS</MenuItem>
              {availableTokens.map((t) => (
                <MenuItem key={t} value={t}>
                  {t}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box>
            <Typography gutterBottom sx={{ fontWeight: "medium" }}>
              Amount ({token || "FLSS"})
            </Typography>
            <TextField
              value={amount}
              onChange={handleAmountChange}
              type="number"
              fullWidth
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    {token || "FLSS"}
                  </InputAdornment>
                ),
                sx: { borderRadius: 2 },
              }}
            />
            <Box sx={{ mt: 2, px: 1 }}>
              <Slider
                value={percentage}
                onChange={handlePercentageChange}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${value}%`}
                marks={[
                  { value: 0, label: "0%" },
                  { value: 25, label: "25%" },
                  { value: 50, label: "50%" },
                  { value: 75, label: "75%" },
                  { value: 100, label: "100%" },
                ]}
              />
            </Box>
            {renderAvailableBalance()}
          </Box>

          <Box>
            <Typography gutterBottom sx={{ fontWeight: "medium" }}>
              Receiver Address
            </Typography>
            <Box sx={{ display: "flex", gap: 1 }}>
              <TextField
                value={receiver}
                onChange={(e) => setReceiver(e.target.value)}
                fullWidth
                placeholder="Enter or scan address"
                InputProps={{
                  sx: { borderRadius: 2 },
                }}
              />
              <Tooltip title="Scan QR Code">
                <IconButton
                  onClick={() => setShowScanner(true)}
                  sx={{
                    bgcolor: "action.hover",
                    "&:hover": { bgcolor: "action.selected" },
                    height: "56px",
                    width: "56px",
                    borderRadius: 2,
                    flexShrink: 0,
                  }}
                >
                  <QrCodeScannerIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography>Lock transaction</Typography>
              <Tooltip title="If enabled, the receiver will only receive the funds once a set date passes. During this time no one can access these funds, making them locked.">
                <IconButton size="small">
                  <InfoIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            <Switch
              value={useUnlock}
              onChange={(e) => setUseUnlock(e.target.checked)}
            />
          </Box>

          {useUnlock && (
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <DateTimePicker
                label="Unlock funds at:"
                value={dayjs(unlock)}
                onChange={(newValue) => {
                  if (newValue) {
                    setUnlock(newValue.valueOf()); // convert to timestamp
                  }
                }}
              />
            </LocalizationProvider>
          )}

          <Button
            variant="contained"
            onClick={handleSend}
            disabled={!receiver || !amount || loading}
            fullWidth
            sx={{
              mt: 2,
              borderRadius: 2,
              textTransform: "none",
              fontWeight: "bold",
              py: 1.5,
            }}
          >
            {loading ? <CircularProgress size={24} /> : "Send"}
          </Button>
        </Box>

        {error && (
          <Alert
            severity="error"
            sx={{
              mt: 2,
              borderRadius: 2,
              "& .MuiAlert-icon": { alignItems: "center" },
            }}
          >
            {error}
          </Alert>
        )}
      </Paper>

      <Dialog
        open={showScanner}
        onClose={handleScannerClose}
        maxWidth="xs"
        fullWidth
        disableEnforceFocus
      >
        <DialogTitle sx={{ textAlign: "center" }}>Scan QR Code</DialogTitle>
        <DialogContent sx={{ textAlign: "center", pb: 3 }}>
          {scannerError ? (
            <Alert
              severity="error"
              sx={{
                mb: 2,
                borderRadius: 2,
                "& .MuiAlert-icon": { alignItems: "center" },
              }}
            >
              {scannerError}
            </Alert>
          ) : (
            <Box
              sx={{
                width: "100%",
                maxWidth: 300,
                mx: "auto",
                mb: 2,
                "& #qr-reader": {
                  width: "100% !important",
                  "& video": {
                    borderRadius: 8,
                  },
                },
              }}
            >
              <div id="qr-reader" />
            </Box>
          )}
          <Typography variant="body2" color="text.secondary">
            {scannerError
              ? "Please fix the error above to scan QR codes"
              : "Position the QR code within the frame to scan"}
          </Typography>
        </DialogContent>
      </Dialog>
    </Box>
  );
} 