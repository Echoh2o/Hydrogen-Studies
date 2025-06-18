

    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-tabs'],
          charts: ['recharts', 'chart.js'],
          admin: [
            './src/pages/admin/AdminDashboard.tsx',
            './src/pages/admin/BlogsPage.tsx',
            './src/pages/admin/StudiesPage.tsx',
            './src/pages/admin/AnalyticsPage.tsx'
          ]
        }
      }
    }
