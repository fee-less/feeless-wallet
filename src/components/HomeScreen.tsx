import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  Stack,
  useTheme,
  useMediaQuery,
  Dialog,
  DialogContent,
  DialogTitle,
  Chip,
  Badge,
  CardMedia
} from '@mui/material';
import { FeelessClient, fPointsToFLSS } from 'feeless-utils';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import RefreshIcon from '@mui/icons-material/Refresh';
import SendIcon from '@mui/icons-material/Send';
import AddIcon from '@mui/icons-material/Add';
import QrCodeIcon from '@mui/icons-material/QrCode';
import HistoryIcon from '@mui/icons-material/History';
import NetworkCheckIcon from '@mui/icons-material/NetworkCheck';
import { CompactQRCode } from './CompactQRCode';

interface HomeScreenProps {
  client: FeelessClient;
  onNavigate: (screen: 'send' | 'mint', initialToken?: string) => void;
}

interface TokenBalance {
  token: string;
  balance: number;
  unconfirmedBalance?: number;
}

interface Transaction {
  type: 'send' | 'receive' | 'mint';
  amount: number;
  token?: string;
  timestamp: number;
  status: 'confirmed' | 'pending';
  address: string;
  blockHeight?: number;
}

// Format large numbers with K, M, B suffixes
const formatNumber = (num: number, isToken = false): string => {
  console.log(num)
  if (isToken) {
    // For tokens, divide by 1000 to convert from stored value to display value
    const tokenValue = num / 1000;
    if (tokenValue >= 1_000_000_000) return `${(tokenValue / 1_000_000_000).toFixed(3)}B`;
    if (tokenValue >= 1_000_000) return `${(tokenValue / 1_000_000).toFixed(3)}M`;
    if (tokenValue >= 1_000) return `${(tokenValue / 1_000).toFixed(3)}K`;
    return tokenValue.toLocaleString('en-US', { 
      minimumFractionDigits: 3,
      maximumFractionDigits: 3
    });
  }
  const flss = fPointsToFLSS(num);
  return typeof flss === 'string' ? flss : flss.toString();
};

export function HomeScreen({ client, onNavigate }: HomeScreenProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [nativeBalance, setNativeBalance] = useState<number>(0);
  const [nativeUnconfirmedBalance, setNativeUnconfirmedBalance] = useState<number | undefined>();
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publicAddress, setPublicAddress] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<'connected' | 'disconnected'>('connected');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [portfolioValue, setPortfolioValue] = useState<number>(0);

  const loadBalances = async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // Get public address
      setPublicAddress(client.getPublic());

      // Load native balance with mempool for total available amount
      const balanceWithMempool = await client.pollBalance("", true);
      setNativeBalance(balanceWithMempool);

      const confirmedBalance = await client.pollBalance();
      setNativeUnconfirmedBalance(confirmedBalance !== balanceWithMempool ? confirmedBalance : undefined);

      // Load token balances
      const tokens = await client.getTokens();
      const tokenBalances = await Promise.all(
        tokens.map(async (token) => {
          // Get total available balance (including mempool)
          const balanceWithMempool = await client.pollBalance(token, true);
          // Get confirmed balance for reference
          const confirmedBalance = await client.pollBalance(token);
          // Multiply by 1000 to store with 3 decimal places
          return {
            token,
            balance: balanceWithMempool * 1000,
            unconfirmedBalance: confirmedBalance !== balanceWithMempool ? confirmedBalance * 1000 : undefined
          };
        })
      );

      setTokenBalances(tokenBalances);

      // Also refresh transaction history when refreshing balances
      if (showRefreshing) {
        await loadTransactions();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadTransactions = async () => {
    try {
      const transactions = await client.getHistory();
      setTransactions(transactions);
    } catch (err) {
      console.error('Failed to load transactions:', err);
    }
  };

  useEffect(() => {
    loadBalances();
    loadTransactions();
    // Refresh balances and transaction history every 10 seconds
    const refreshInterval = setInterval(() => loadBalances(true), 10000);
    // Poll network status every 5 seconds
    const statusInterval = setInterval(async () => {
      try {
        await client.pollBalance();
        setNetworkStatus('connected');
      } catch {
        setNetworkStatus('disconnected');
      }
    }, 5000);
    return () => {
      clearInterval(refreshInterval);
      clearInterval(statusInterval);
    };
  }, [client]);

  // Update portfolio value calculation to only use FLSS balance
  useEffect(() => {
    setPortfolioValue(nativeBalance);
  }, [nativeBalance]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(publicAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const renderBalance = (balance: number, unconfirmedBalance?: number, isToken = false) => {
    const displayBalance = formatNumber(balance, isToken);
    const displayUnconfirmed = unconfirmedBalance !== undefined 
      ? formatNumber(unconfirmedBalance, isToken)
      : undefined;

    return (
      <Box sx={{ 
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.5,
        width: '100%',
        overflow: 'hidden'
      }}>
        <Typography 
          variant={isMobile ? "h5" : "h4"}
          sx={{ 
            fontWeight: 'bold',
            textAlign: 'center',
            width: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {displayBalance} {isToken ? '' : 'FLSS'}
        </Typography>
        {displayUnconfirmed !== undefined && (
          <Tooltip title="Confirmed balance (ignores pending transactions)">
            <Typography 
              variant="body2"
              sx={{ 
                color: 'warning.main',
                textAlign: 'center'
              }}
            >
              {displayUnconfirmed} {isToken ? '' : 'FLSS'} (confirmed)
            </Typography>
          </Tooltip>
        )}
      </Box>
    );
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const getTransactionIcon = (type: Transaction['type']) => {
    switch (type) {
      case 'send': return <SendIcon fontSize="small" />;
      case 'receive': return <QrCodeIcon fontSize="small" />;
      case 'mint': return <AddIcon fontSize="small" />;
    }
  };

  const getTransactionTypeLabel = (type: Transaction['type']) => {
    switch (type) {
      case 'send': return 'Sent';
      case 'receive': return 'Received';
      case 'mint': return 'Minted';
    }
  };

  return (
    <Box sx={{ 
      maxWidth: 800, 
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
        <Stack spacing={3}>
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            mb: 2
          }}>
            <Box sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 2,
              gap: 2
            }}>
              <CardMedia component="img" image="logo.svg" alt="Logo" sx={{ height: 70, width: 'auto' }} />
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                  Feeless Vault
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                  <Chip
                    icon={<NetworkCheckIcon />}
                    label={networkStatus === 'connected' ? 'Connected' : 'Disconnected'}
                    color={networkStatus === 'connected' ? 'success' : 'error'}
                    size="small"
                    sx={{ height: 24 }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    v1.0.0
                  </Typography>
                </Box>
              </Box>
            </Box>
            
            <Box sx={{ display: '>flex', gap: 1 }}>
              <Tooltip title="Transaction History">
                <IconButton 
                  onClick={() => setShowHistory(true)}
                  sx={{ 
                    bgcolor: 'action.hover',
                    '&:hover': { bgcolor: 'action.selected' }
                  }}
                >
                  <Badge badgeContent={transactions.filter(t => t.status === 'pending').length} color="warning">
                    <HistoryIcon />
                  </Badge>
                </IconButton>
              </Tooltip>
              <Tooltip title="Refresh Balances">
                <IconButton 
                  onClick={() => loadBalances(true)}
                  disabled={refreshing}
                  sx={{ 
                    bgcolor: 'action.hover',
                    '&:hover': { bgcolor: 'action.selected' }
                  }}
                >
                  {refreshing ? <CircularProgress size={24} /> : <RefreshIcon />}
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          <Card 
            elevation={0}
            sx={{ 
              bgcolor: 'background.paper',
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              position: 'relative',
              overflow: 'visible'
            }}
          >
            <Box sx={{ 
              position: 'absolute',
              top: -12,
              left: '50%',
              transform: 'translateX(-50%)',
              bgcolor: 'background.paper',
              px: 2,
              py: 0.5,
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider'
            }}>
              <Typography variant="caption" color="text.secondary">
                FLSS Balance
              </Typography>
            </Box>
            <CardContent>
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1,
                bgcolor: 'action.hover',
                p: 1,
                borderRadius: 1,
                mb: 2
              }}>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    wordBreak: 'break-all',
                    fontFamily: 'monospace',
                    fontSize: '0.875rem'
                  }}
                >
                  {publicAddress}
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <Tooltip title={copied ? "Copied!" : "Copy address"}>
                    <IconButton 
                      onClick={copyToClipboard} 
                      size="small"
                      sx={{ 
                        bgcolor: 'background.paper',
                        '&:hover': { bgcolor: 'action.selected' }
                      }}
                    >
                      {copied ? <CheckIcon /> : <ContentCopyIcon />}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Show QR Code">
                    <IconButton 
                      size="small"
                      onClick={() => setShowQR(true)}
                      sx={{
                        bgcolor: 'background.paper',
                        '&:hover': { bgcolor: 'action.selected' }
                      }}
                    >
                      <QrCodeIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>

              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h3" sx={{ fontWeight: 'bold', mb: 1 }}>
                    {formatNumber(portfolioValue)} FLSS
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Native Balance
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <Stack 
                direction={{ xs: 'column', md: 'row' }} 
                spacing={2}
                sx={{ width: '100%' }}
              >
                <Card 
                  elevation={0}
                  sx={{ 
                    flex: 1,
                    bgcolor: 'background.paper',
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  <Box sx={{ 
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 4,
                    bgcolor: 'primary.main',
                    opacity: 0.2
                  }} />
                  <CardContent>
                    <Typography 
                      variant="h6" 
                      gutterBottom 
                      align="center"
                      sx={{ fontWeight: 'medium' }}
                    >
                      Native Balance
                    </Typography>
                    <Box sx={{ mb: 2 }}>
                      {renderBalance(nativeBalance, nativeUnconfirmedBalance)}
                    </Box>
                    <Button
                      variant="contained"
                      fullWidth
                      startIcon={<SendIcon />}
                      onClick={() => onNavigate('send', 'Native FLSS')}
                      sx={{ 
                        borderRadius: 2,
                        textTransform: 'none',
                        fontWeight: 'bold'
                      }}
                    >
                      Send FLSS
                    </Button>
                  </CardContent>
                </Card>

                <Card 
                  elevation={0}
                  sx={{ 
                    flex: 1,
                    bgcolor: 'background.paper',
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'divider'
                  }}
                >
                  <CardContent>
                    <Typography 
                      variant="h6" 
                      gutterBottom 
                      align="center"
                      sx={{ fontWeight: 'medium' }}
                    >
                      Quick Actions
                    </Typography>
                    <Stack spacing={2}>
                      <Button
                        variant="contained"
                        fullWidth
                        startIcon={<SendIcon />}
                        onClick={() => onNavigate('send')}
                        sx={{ 
                          borderRadius: 2,
                          textTransform: 'none',
                          fontWeight: 'bold'
                        }}
                      >
                        Send Tokens
                      </Button>
                      <Button
                        variant="contained"
                        fullWidth
                        startIcon={<AddIcon />}
                        onClick={() => onNavigate('mint')}
                        sx={{ 
                          borderRadius: 2,
                          textTransform: 'none',
                          fontWeight: 'bold'
                        }}
                      >
                        Mint New Token
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              </Stack>

              {tokenBalances.length > 0 && (
                <Box>
                  <Typography 
                    variant="h6" 
                    gutterBottom 
                    align="center" 
                    sx={{ 
                      mb: 2,
                      fontWeight: 'medium'
                    }}
                  >
                    Token Balances
                  </Typography>
                  <Stack 
                    spacing={2}
                    sx={{ 
                      display: 'grid',
                      gridTemplateColumns: {
                        xs: '1fr',
                        sm: 'repeat(2, 1fr)',
                        md: 'repeat(3, 1fr)'
                      },
                      gap: 2
                    }}
                  >
                    {tokenBalances.map(({ token, balance, unconfirmedBalance }) => (
                      <Card 
                        key={token}
                        elevation={0}
                        sx={{ 
                          bgcolor: 'background.paper',
                          borderRadius: 2,
                          border: '1px solid',
                          borderColor: 'divider',
                          position: 'relative',
                          overflow: 'hidden'
                        }}
                      >
                        <Box sx={{ 
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: 4,
                          bgcolor: 'secondary.main',
                          opacity: 0.2
                        }} />
                        <CardContent>
                          <Typography 
                            variant="subtitle1" 
                            sx={{ fontWeight: 'medium', mb: 1 }}
                          >
                            {token}
                          </Typography>
                          <Box sx={{ mb: 2 }}>
                            {renderBalance(balance, unconfirmedBalance, true)}
                          </Box>
                          <Button
                            variant="outlined"
                            fullWidth
                            startIcon={<SendIcon />}
                            onClick={() => onNavigate('send', token)}
                            sx={{ 
                              borderRadius: 2,
                              textTransform: 'none',
                              fontWeight: 'bold'
                            }}
                          >
                            Send
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
                </Box>
              )}
            </>
          )}

          {error && (
            <Alert 
              severity="error"
              sx={{ 
                borderRadius: 2,
                '& .MuiAlert-icon': { alignItems: 'center' }
              }}
            >
              {error}
            </Alert>
          )}
        </Stack>
      </Paper>

      <Dialog 
        open={showQR} 
        onClose={() => setShowQR(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ textAlign: 'center' }}>
          Scan to Receive
        </DialogTitle>
        <DialogContent sx={{ textAlign: 'center', pb: 3 }}>
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center',
            p: 1,
            borderRadius: 1,
            mb: 1
          }}>
            <CompactQRCode
              value={publicAddress}
              size={120}
              margin={0}
            />
          </Box>
          <Typography variant="body2" color="text.secondary">
            Scan this code to receive FLSS or tokens
          </Typography>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showHistory}
        onClose={() => setShowHistory(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ textAlign: 'center' }}>
          Transaction History
        </DialogTitle>
        <DialogContent sx={{ pb: 3 }}>
          <Stack spacing={2}>
            {transactions.map((tx, index) => (
              <Card
                key={index}
                elevation={0}
                sx={{
                  bgcolor: 'background.paper',
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider'
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Box sx={{ 
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      bgcolor: tx.type === 'receive' ? 'success.light' : 
                               tx.type === 'mint' ? 'info.light' : 'primary.light',
                      color: tx.type === 'receive' ? 'success.dark' : 
                             tx.type === 'mint' ? 'info.dark' : 'primary.dark'
                    }}>
                      {getTransactionIcon(tx.type)}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'medium' }}>
                        {getTransactionTypeLabel(tx.type)} {tx.token || 'FLSS'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatTimestamp(tx.timestamp)}
                        {tx.blockHeight !== undefined && ` • Block #${tx.blockHeight}`}
                      </Typography>
                    </Box>
                    <Chip
                      label={tx.status}
                      color={tx.status === 'confirmed' ? 'success' : 'warning'}
                      size="small"
                    />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                    {formatNumber(tx.amount, !!tx.token)} {tx.token || 'FLSS'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    {tx.type === 'receive' ? 'From: ' : 'To: '}{tx.address}
                  </Typography>
                </CardContent>
              </Card>
            ))}
            {transactions.length === 0 && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography color="text.secondary">
                  No transactions yet
                </Typography>
              </Box>
            )}
          </Stack>
        </DialogContent>
      </Dialog>
    </Box>
  );
} 