import { createAppKit } from '@reown/appkit'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { mainnet, arbitrum } from '@reown/appkit/networks'

// Получите Project ID на https://dashboard.reown.com
const projectId = process.env.REACT_APP_WALLETCONNECT_PROJECT_ID; // Замените на ваш Project ID

// Кастомная сеть Monad Testnet
const monadTestnet = {
  id: 10143,
  name: 'Monad Testnet',
  network: 'monad-testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Monad',
    symbol: 'MON',
  },
  rpcUrls: {
    default: {
      http: ['https://testnet-rpc.monad.xyz/'],
    },
    public: {
      http: ['https://testnet-rpc.monad.xyz/'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Monad Explorer',
      url: 'https://testnet.monadvision.com',
    },
  },
  testnet: true,
}

const monadMainnet = {
  id: 143,
  name: 'Monad Mainnet',
  network: 'monad-mainnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Monad',
    symbol: 'MON',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc1.monad.xyz'],
    },
    public: {
      http: ['https://rpc1.monad.xyz'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Monad Explorer',
      url: 'https://monadvision.com/',
    },
  },
  testnet: false,
}

const ethMainnet = {
  id: 1,
  name: 'Ethereum',
  network: 'eth-mainnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Ethereum',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['https://eth.llamarpc.com'],
    },
    public: {
      http: ['https://eth.llamarpc.com'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Ethereum',
      url: 'https://etherscan.io',
    },
  },
  testnet: false,
}

const ethSepolia = {
  id: 11155111,
  name: 'Sepolia',
  network: 'eth-sepolia',
  nativeCurrency: {
    decimals: 18,
    name: 'Sepolia',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['https://ethereum-sepolia-rpc.publicnode.com'],
    },
    public: {
      http: ['https://ethereum-sepolia-rpc.publicnode.com'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Sepolia Ethereum',
      url: 'https://sepolia.etherscan.io',
    },
  },
  testnet: false,
}

const baseMainnet = {
  id: 8453,
  name: 'Base',
  network: 'base-mainnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Base',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['https://base-rpc.publicnode.com'],
    },
    public: {
      http: ['https://base-rpc.publicnode.com'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Base',
      url: 'https://basescan.org',
    },
  },
  testnet: false,
}

// Настройка сетей
export const networks = [monadMainnet, ethMainnet, baseMainnet, monadTestnet, ethSepolia]

// Метаданные приложения
const metadata = {
  name: 'Happy Vote App',
  description: 'Make the world happier with blockchain voting',
  url: 'https://www.happyvote.xyz/',
  icons: ['https://avatars.githubusercontent.com/u/179229932']
}

// Создание адаптера Wagmi
export const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks
})

// Создание модального окна AppKit
export const modal = createAppKit({
  adapters: [wagmiAdapter],
  networks: networks,
  metadata,
  projectId,
  features: {
    analytics: true
  },
  themeVariables: {
    '--apkt-font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif'
  }
})

// Функции для работы с кошельком
export const openConnectModal = () => {
  modal.open()
}

export const openNetworkModal = () => {
  modal.open({ view: 'Networks' })
}

export const closeModal = () => {
  modal.close()
}
