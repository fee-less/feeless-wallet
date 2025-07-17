# Feeless Wallet

A web-based wallet for the Feeless blockchain. This wallet allows you to:
- Generate new wallets
- View your balance
- Send FLS tokens
- Send custom tokens

## Setup

1. Make sure you have Node.js installed (version 16 or higher)
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to `http://localhost:3000`

## Usage

1. Generate a new wallet or import an existing one using your private key
2. Initialize the wallet to connect to the Feeless node
3. View your balance and send transactions
4. For custom tokens, enter the token name in the token field when sending

## Development

- The wallet connects to a local Feeless node by default (`ws://localhost:8080` and `http://localhost:8080`)
- To change the node address, modify the `initializeWallet` function in `src/App.tsx`

## Building for Production

To build the wallet for production:

```bash
npm run build
```

The built files will be in the `dist` directory. 