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
      http: ['https://rpc.monad.xyz'],
    },
    public: {
      http: ['https://rpc.monad.xyz'],
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

// Настройка сетей
export const networks = [mainnet, arbitrum, monadTestnet, monadMainnet]

// Метаданные приложения
const metadata = {
  name: 'Happy Vote App',
  description: 'Make the world happier with blockchain voting',
  url: 'https://happy-vote-app.vercel.app',
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
