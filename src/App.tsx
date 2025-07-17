import { useState } from 'react';
import { Container, Box } from '@mui/material';
import { FeelessClient } from 'feeless-utils';
import { LoginScreen } from './components/LoginScreen';
import { HomeScreen } from './components/HomeScreen';
import { SendScreen } from './components/SendScreen';
import { MintScreen } from './components/MintScreen';

type Screen = 'login' | 'home' | 'send' | 'mint';

function App() {
  const [screen, setScreen] = useState<Screen>('login');
  const [client, setClient] = useState<FeelessClient | null>(null);
  const [initialToken, setInitialToken] = useState<string | undefined>();

  const handleLogin = (privateKey: string, wsNode: string, httpNode: string) => {
    const newClient = new FeelessClient(wsNode, httpNode, privateKey);
    newClient.init().then(success => {
      if (success) {
        setClient(newClient);
        setScreen('home');
      }
    });
  };

  const handleNavigate = (newScreen: Screen, token?: string) => {
    setScreen(newScreen);
    setInitialToken(token);
  };

  return (
    <Container>
      <Box sx={{ my: 4 }}>
        {screen === 'login' && (
          <LoginScreen onLogin={handleLogin} />
        )}
        {screen === 'home' && client && (
          <HomeScreen
            client={client}
            onNavigate={handleNavigate}
          />
        )}
        {screen === 'send' && client && (
          <SendScreen
            client={client}
            onBack={() => setScreen('home')}
            initialToken={initialToken}
          />
        )}
        {screen === 'mint' && client && (
          <MintScreen
            client={client}
            onBack={() => setScreen('home')}
          />
        )}
      </Box>
    </Container>
  );
}

export default App; 