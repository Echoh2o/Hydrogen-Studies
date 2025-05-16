/**
 * ResponsiveContainer component that automatically adjusts layout based on screen size
 */
import { ReactNode } from 'react';
import { useScreenSize } from '@/lib/responsive';

interface ResponsiveContainerProps {
  children: ReactNode;
  className?: string;
  mobileClassName?: string;
  tabletClassName?: string;
  desktopClassName?: string;
  fullWidth?: boolean;
  padding?: 'none' | 'small' | 'medium' | 'large';
}

export default function ResponsiveContainer({
  children,
  className = '',
  mobileClassName = '',
  tabletClassName = '',
  desktopClassName = '',
  fullWidth = false,
  padding = 'medium',
}: ResponsiveContainerProps) {
  const { isMobile, isTablet } = useScreenSize();
  
  // Determine padding classes
  const paddingClasses = padding === 'none' 
    ? '' 
    : padding === 'small'
      ? 'px-4 py-3 sm:px-6 sm:py-4 lg:px-8 lg:py-5'
      : padding === 'large'
        ? 'px-4 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-10'
        : 'px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8'; // medium (default)

  // Determine width classes
  const widthClasses = fullWidth 
    ? 'w-full' 
    : 'w-full max-w-7xl mx-auto';
  
  // Combine device-specific classes
  const responsiveClasses = [
    isMobile ? mobileClassName : '',
    isTablet ? tabletClassName : '',
    !isMobile && !isTablet ? desktopClassName : ''
  ].filter(Boolean).join(' ');

  return (
    <div className={`${widthClasses} ${paddingClasses} ${responsiveClasses} ${className}`}>
      {children}
    </div>
  );
}

/**
 * Two-column layout that stacks on mobile
 */
interface ResponsiveTwoColumnProps {
  leftColumn: ReactNode;
  rightColumn: ReactNode;
  reverseOnMobile?: boolean;
  leftColumnWidth?: 'narrow' | 'medium' | 'wide' | 'equal';
  gap?: 'small' | 'medium' | 'large';
  className?: string;
  leftColumnClassName?: string;
  rightColumnClassName?: string;
}

export function ResponsiveTwoColumn({
  leftColumn,
  rightColumn,
  reverseOnMobile = false,
  leftColumnWidth = 'medium',
  gap = 'medium',
  className = '',
  leftColumnClassName = '',
  rightColumnClassName = '',
}: ResponsiveTwoColumnProps) {
  // Determine left column width classes
  const leftWidthClasses = 
    leftColumnWidth === 'narrow' ? 'lg:w-1/3' :
    leftColumnWidth === 'wide' ? 'lg:w-2/3' :
    leftColumnWidth === 'equal' ? 'lg:w-1/2' : 
    'lg:w-2/5'; // medium (default)
  
  // Determine right column width classes
  const rightWidthClasses = 
    leftColumnWidth === 'narrow' ? 'lg:w-2/3' :
    leftColumnWidth === 'wide' ? 'lg:w-1/3' :
    leftColumnWidth === 'equal' ? 'lg:w-1/2' : 
    'lg:w-3/5'; // medium (default)
  
  // Determine gap classes
  const gapClasses = 
    gap === 'small' ? 'gap-4 lg:gap-6' :
    gap === 'large' ? 'gap-8 lg:gap-12' :
    'gap-6 lg:gap-8'; // medium (default)
  
  // Mobile order classes
  const leftOrderClass = reverseOnMobile ? 'order-2 lg:order-1' : '';
  const rightOrderClass = reverseOnMobile ? 'order-1 lg:order-2' : '';

  return (
    <div className={`w-full flex flex-col lg:flex-row ${gapClasses} ${className}`}>
      <div className={`w-full ${leftWidthClasses} ${leftOrderClass} ${leftColumnClassName}`}>
        {leftColumn}
      </div>
      <div className={`w-full ${rightWidthClasses} ${rightOrderClass} ${rightColumnClassName}`}>
        {rightColumn}
      </div>
    </div>
  );
}

/**
 * Grid layout that adjusts columns based on screen size
 */
interface ResponsiveGridProps {
  children: ReactNode;
  mobileColumns?: 1 | 2;
  tabletColumns?: 2 | 3 | 4;
  desktopColumns?: 2 | 3 | 4 | 5 | 6;
  gap?: 'small' | 'medium' | 'large';
  className?: string;
}

export function ResponsiveGrid({
  children,
  mobileColumns = 1,
  tabletColumns = 2,
  desktopColumns = 3,
  gap = 'medium',
  className = '',
}: ResponsiveGridProps) {
  // Determine column classes
  const mobileColClass = mobileColumns === 1 ? 'grid-cols-1' : 'grid-cols-2';
  
  const tabletColClass = 
    tabletColumns === 2 ? 'md:grid-cols-2' :
    tabletColumns === 3 ? 'md:grid-cols-3' :
    'md:grid-cols-4';
  
  const desktopColClass = 
    desktopColumns === 2 ? 'lg:grid-cols-2' :
    desktopColumns === 3 ? 'lg:grid-cols-3' :
    desktopColumns === 4 ? 'lg:grid-cols-4' :
    desktopColumns === 5 ? 'lg:grid-cols-5' :
    'lg:grid-cols-6';
  
  // Determine gap classes
  const gapClasses = 
    gap === 'small' ? 'gap-3 md:gap-4' :
    gap === 'large' ? 'gap-6 md:gap-8' :
    'gap-4 md:gap-6'; // medium (default)

  return (
    <div className={`grid ${mobileColClass} ${tabletColClass} ${desktopColClass} ${gapClasses} ${className}`}>
      {children}
    </div>
  );
}