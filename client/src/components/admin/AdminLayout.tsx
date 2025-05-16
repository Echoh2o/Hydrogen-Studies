import React from 'react';
import { Link, useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { Helmet } from 'react-helmet';
import {
  LayoutDashboard,
  BookText,
  Import,
  Database,
  Search,
  Settings,
  Menu,
  X,
  BarChart
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
  description?: string;
}

export default function AdminLayout({ children, title, description }: AdminLayoutProps) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  const navigation = [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { name: 'Studies Management', href: '/admin/studies', icon: BookText },
    { name: 'Blog Management', href: '/admin/blogs', icon: BookText },
    { name: 'Research Import', href: '/admin/research-import', icon: Database },
    { name: 'Data Import', href: '/admin/data-import', icon: Import },
    { name: 'Analytics', href: '/admin/analytics', icon: BarChart },
    { name: 'Settings', href: '/admin/settings', icon: Settings },
  ];
  
  return (
    <>
      <Helmet>
        <title>{title} - Admin Dashboard - Hydrogen Studies</title>
      </Helmet>
      
      <div className="min-h-screen bg-gray-50">
        {/* Mobile sidebar toggle */}
        <div className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between p-4 bg-white border-b">
          <h2 className="text-xl font-bold">{title}</h2>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
        
        {/* Sidebar for desktop */}
        <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
          <div className="flex flex-col grow overflow-y-auto border-r border-gray-200 bg-white">
            <div className="flex items-center flex-shrink-0 px-4 py-5 border-b">
              <h2 className="text-xl font-bold">Hydrogen Admin</h2>
            </div>
            <div className="mt-5 flex flex-col grow">
              <nav className="flex-1 space-y-1 px-4">
                {navigation.map((item) => {
                  const isActive = location === item.href || location.startsWith(`${item.href}/`);
                  return (
                    <Link 
                      key={item.name} 
                      href={item.href}
                    >
                      <a className={cn(
                        isActive 
                          ? 'bg-gray-100 text-primary-600' 
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                        'group flex items-center px-3 py-2 text-sm font-medium rounded-md my-1'
                      )}>
                        <item.icon 
                          className={cn(
                            isActive ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-500',
                            'mr-3 flex-shrink-0 h-5 w-5'
                          )} 
                          aria-hidden="true" 
                        />
                        {item.name}
                      </a>
                    </Link>
                  );
                })}
              </nav>
            </div>
            <div className="flex flex-shrink-0 p-4 border-t border-gray-200">
              <Link href="/">
                <a className="text-sm text-primary-600 hover:text-primary-800">
                  Back to website
                </a>
              </Link>
            </div>
          </div>
        </div>
        
        {/* Mobile sidebar */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
            
            <div className="fixed inset-y-0 left-0 flex flex-col w-64 max-w-xs bg-white">
              <div className="flex items-center justify-between h-16 px-4 border-b">
                <h2 className="text-xl font-bold">Hydrogen Admin</h2>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setSidebarOpen(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
                {navigation.map((item) => {
                  const isActive = location === item.href || location.startsWith(`${item.href}/`);
                  return (
                    <Link 
                      key={item.name} 
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <a className={cn(
                        isActive 
                          ? 'bg-gray-100 text-primary-600' 
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                        'group flex items-center px-3 py-2 text-sm font-medium rounded-md'
                      )}>
                        <item.icon 
                          className={cn(
                            isActive ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-500',
                            'mr-3 flex-shrink-0 h-5 w-5'
                          )} 
                          aria-hidden="true" 
                        />
                        {item.name}
                      </a>
                    </Link>
                  );
                })}
              </div>
              <div className="flex-shrink-0 p-4 border-t">
                <Link href="/">
                  <a className="text-sm text-primary-600 hover:text-primary-800">
                    Back to website
                  </a>
                </Link>
              </div>
            </div>
          </div>
        )}
        
        {/* Main content */}
        <div className="lg:pl-64 flex flex-col">
          <main className="flex-1">
            {/* Header with title and description */}
            <div className="bg-white shadow">
              <div className="px-4 py-6 sm:px-6 lg:px-8">
                <div className="lg:flex lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate">
                      {title}
                    </h2>
                    {description && (
                      <p className="mt-1 text-sm text-gray-500">
                        {description}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Page content */}
            <div className="px-4 sm:px-6 lg:px-8 py-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </>
  );
}