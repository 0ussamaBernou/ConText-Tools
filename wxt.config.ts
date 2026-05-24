import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    name: 'ConText Tools',
    description: 'AI-powered proofreading tooltip for text inputs. Select text, click Proofread, done.',
    permissions: ['storage'],
    host_permissions: [
      'https://generativelanguage.googleapis.com/*',
      'https://openrouter.ai/*',
    ],
  },
});
