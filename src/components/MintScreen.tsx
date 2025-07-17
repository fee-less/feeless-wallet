import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  FormControlLabel,
  Switch
} from '@mui/material';
import { FeelessClient, TokenMint, fPointsToFLSS } from 'feeless-utils';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import InfoIcon from '@mui/icons-material/Info';
import debounce from 'lodash/debounce';

interface MintScreenProps {
  client: FeelessClient;
  onBack: () => void;
}

export function MintScreen({ client, onBack }: MintScreenProps) {
  const [tokenName, setTokenName] = useState('');
  const [airdrop, setAirdrop] = useState('');
  const [miningReward, setMiningReward] = useState('');
  const [enableMining, setEnableMining] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mintFee, setMintFee] = useState<number>(0);
  const [balance, setBalance] = useState<number>(0);
  const [checkingToken, setCheckingToken] = useState(false);

  useEffect(() => {
    const checkFeeAndBalance = async () => {
      try {
        const [fee, bal] = await Promise.all([
          client.getMintFee(),
          client.pollBalance()
        ]);
        setMintFee(fee);
        setBalance(bal);
      } catch (err) {
        console.error('Error fetching fee or balance:', err);
      }
    };

    // Initial check
    checkFeeAndBalance();

    // Set up polling every 3 seconds
    const interval = setInterval(checkFeeAndBalance, 3000);

    // Cleanup on unmount
    return () => clearInterval(interval);
  }, [client]);

  // Create a debounced function to check token availability
  const debouncedCheckToken = useCallback(
    debounce(async (name: string) => {
      if (!name) return;
      
      const validationError = validateTokenName(name);
      if (validationError) {
        setError(validationError);
        return;
      }

      try {
        setCheckingToken(true);
        await client.getTokenInfo(name);
        setError('Token name is already taken');
      } catch (err) {
        // If getTokenInfo throws, the token doesn't exist, which is what we want
        setError(null);
      } finally {
        setCheckingToken(false);
      }
    }, 500),
    [client]
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedCheckToken.cancel();
    };
  }, [debouncedCheckToken]);

  const validateTokenName = (name: string): string | null => {
    if (!name) {
      return 'Token name is required';
    }
    if (name.toLowerCase() === 'flss') {
      return 'Token name cannot be "FLSS"';
    }
    if (name.length >= 20) {
      return 'Token name must be less than 20 characters';
    }
    if (!/^[A-Z]+$/.test(name)) {
      return 'Token name must contain only uppercase letters (A-Z) with no spaces or special characters';
    }
    return null;
  };

  const handleTokenNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    setTokenName(value);
    debouncedCheckToken(value);
  };

  const handleAirdropChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d+$/.test(value)) {
      const numValue = value === '' ? 0 : parseInt(value);
      if (numValue > Number.MAX_SAFE_INTEGER) {
        setError('Airdrop amount exceeds maximum safe value');
        return;
      }
      setAirdrop(value);
      setError(null);
    }
  };

  const handleMiningRewardChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d+$/.test(value)) {
      const numValue = value === '' ? 0 : parseInt(value);
      if (numValue > Number.MAX_SAFE_INTEGER) {
        setError('Mining reward amount exceeds maximum safe value');
        return;
      }
      setMiningReward(value);
      setError(null);
    }
  };

  const handleMint = async () => {
    const tokenError = validateTokenName(tokenName);
    if (tokenError) {
      setError(tokenError);
      return;
    }

    if (!airdrop) {
      setError('Please enter the airdrop amount');
      return;
    }

    const airdropAmount = parseInt(airdrop);
    if (isNaN(airdropAmount) || airdropAmount < 0) {
      setError('Airdrop amount must be a non-negative number');
      return;
    }
    if (airdropAmount > Number.MAX_SAFE_INTEGER) {
      setError('Airdrop amount exceeds maximum safe value');
      return;
    }

    let miningRewardAmount = 0;
    if (enableMining) {
      if (!miningReward) {
        setError('Please enter the mining reward amount');
        return;
      }
      miningRewardAmount = parseInt(miningReward);
      if (isNaN(miningRewardAmount) || miningRewardAmount <= 0) {
        setError('Mining reward must be a positive number');
        return;
      }
      if (miningRewardAmount > Number.MAX_SAFE_INTEGER) {
        setError('Mining reward amount exceeds maximum safe value');
        return;
      }
    }

    try {
      setLoading(true);
      setError(null);
      
      const tokenMint: TokenMint = {
        token: tokenName,
        airdrop: airdropAmount,
        miningReward: enableMining ? miningRewardAmount : undefined
      };
      
      const success = await client.mintToken(tokenMint);
      
      if (success) {
        setTokenName('');
        setAirdrop('');
        setMiningReward('');
        setEnableMining(false);
        onBack();
      } else {
        setError('Token name is already taken');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const hasEnoughBalance = balance >= mintFee;

  const formatFLSS = (fPoints: number) => {
    return fPointsToFLSS(fPoints).toFixed(3);
  };

  return (
    <Box sx={{ 
      maxWidth: 600, 
      mx: 'auto', 
      mt: { xs: 0, sm: 4 }, 
      px: { xs: 1, sm: 2 },
      minHeight: '100vh',
      bgcolor: 'background.default'
    }}>
      <Paper 
        elevation={0} 
        sx={{ 
          p: { xs: 2, sm: 3 },
          borderRadius: { xs: 0, sm: 2 },
          minHeight: '100vh',
          bgcolor: 'background.default'
        }}
      >
        <Box sx={{ mb: 3 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={onBack}
            sx={{ 
              mb: 2,
              textTransform: 'none',
              fontWeight: 'bold'
            }}
          >
            Back
          </Button>
          <Typography 
            variant="h5" 
            gutterBottom 
            sx={{ 
              fontWeight: 'bold',
              textAlign: 'center'
            }}
          >
            Mint New Token
          </Typography>
          <Box sx={{ 
            textAlign: 'center', 
            mb: 3,
            p: 2,
            borderRadius: 2,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: hasEnoughBalance ? 'success.light' : 'error.light'
          }}>
            <Typography 
              variant="body1" 
              sx={{ 
                fontWeight: 'medium',
                mb: 1,
                color: hasEnoughBalance ? 'success.main' : 'error.main'
              }}
            >
              {hasEnoughBalance ? '✓ Sufficient Balance' : '⚠ Insufficient Balance'}
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3 }}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Your Balance
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  {formatFLSS(balance)} FLSS
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Required Fee
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  {formatFLSS(mintFee)} FLSS
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Token Name"
            value={tokenName}
            onChange={handleTokenNameChange}
            fullWidth
            error={!!error && (error.includes('Token name') || error === 'Token name is already taken')}
            helperText={
              error && (error.includes('Token name') || error === 'Token name is already taken')
                ? error 
                : 'Token name must be uppercase letters A-Z only (max 20 chars, no spaces or special characters)'
            }
            sx={{ borderRadius: 2 }}
            inputProps={{
              style: { textTransform: 'uppercase' }
            }}
            InputProps={{
              endAdornment: checkingToken ? (
                <CircularProgress size={20} />
              ) : null
            }}
          />

          <TextField
            label="Airdrop Amount"
            value={airdrop}
            onChange={handleAirdropChange}
            type="number"
            fullWidth
            error={!!error && error.includes('Airdrop')}
            helperText={
              error && error.includes('Airdrop')
                ? error
                : 'Enter the amount of tokens to airdrop to the minter (0 for no airdrop)'
            }
            sx={{ borderRadius: 2 }}
          />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={enableMining}
                  onChange={(e) => setEnableMining(e.target.checked)}
                />
              }
              label="Enable Mining"
            />
            <Tooltip title="If enabled, miners can earn rewards for mining blocks with this token">
              <IconButton size="small">
                <InfoIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          {enableMining && (
            <TextField
              label="Mining Reward"
              value={miningReward}
              onChange={handleMiningRewardChange}
              type="number"
              fullWidth
              error={!!error && error.includes('Mining reward')}
              helperText={
                error && error.includes('Mining reward')
                  ? error
                  : 'Enter the mining reward amount per block'
              }
              sx={{ borderRadius: 2 }}
            />
          )}

          <Button
            variant="contained"
            onClick={handleMint}
            disabled={!tokenName || !airdrop || (enableMining && !miningReward) || loading || !!error || !hasEnoughBalance}
            fullWidth
            sx={{ 
              mt: 2,
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 'bold',
              py: 1.5
            }}
          >
            {loading ? <CircularProgress size={24} /> : 'Mint Token'}
          </Button>
        </Box>

        {error && !error.includes('Token name') && !error.includes('Airdrop') && !error.includes('Mining reward') && (
          <Alert 
            severity="error" 
            sx={{ 
              mt: 2,
              borderRadius: 2,
              '& .MuiAlert-icon': { alignItems: 'center' }
            }}
          >
            {error}
          </Alert>
        )}
      </Paper>
    </Box>
  );
} 