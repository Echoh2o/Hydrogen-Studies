/**
 * Service-specific error handlers for external APIs and file operations
 */

import { ExternalAPIError, FileUploadError, AppError, ErrorCode } from './app-errors';
import { withRetry } from './database-wrapper';

/**
 * OpenAI API error handler with fallback responses
 */
export async function handleOpenAIRequest<T>(
  operation: () => Promise<T>,
  fallbackResponse?: T,
  context?: { prompt?: string; model?: string }
): Promise<T> {
  try {
    // Retry logic for OpenAI requests
    return await withRetry(operation, {
      maxRetries: 2,
      retryDelay: 2000,
      onRetry: (attempt, error) => {
        console.log(`OpenAI retry attempt ${attempt}:`, error.message);
      }
    });
  } catch (error: any) {
    const errorMessage = error?.response?.data?.error?.message || error.message;
    const statusCode = error?.response?.status;

    // Handle specific OpenAI error codes
    if (statusCode === 429 || errorMessage?.includes('rate limit')) {
      throw new ExternalAPIError(
        'OpenAI',
        'Rate limit exceeded. Please try again later.',
        true,
        { ...context, originalError: errorMessage }
      );
    }

    if (statusCode === 401 || errorMessage?.includes('authentication')) {
      throw new ExternalAPIError(
        'OpenAI',
        'OpenAI API authentication failed. Please check API key.',
        false,
        { ...context, originalError: errorMessage }
      );
    }

    if (statusCode === 503 || errorMessage?.includes('overloaded')) {
      throw new ExternalAPIError(
        'OpenAI',
        'OpenAI service is currently overloaded. Please try again.',
        true,
        { ...context, originalError: errorMessage }
      );
    }

    // Return fallback response if provided
    if (fallbackResponse !== undefined) {
      console.warn('OpenAI request failed, using fallback response:', errorMessage);
      return fallbackResponse;
    }

    throw new ExternalAPIError(
      'OpenAI',
      errorMessage || 'Failed to complete AI request',
      true,
      { ...context, originalError: error.message },
      error
    );
  }
}

/**
 * File upload error handler with size and type validation
 */
export function handleFileUpload(
  file: Express.Multer.File | undefined,
  options: {
    maxSizeMB?: number;
    allowedTypes?: string[];
    required?: boolean;
  } = {}
): Express.Multer.File {
  const { maxSizeMB = 10, allowedTypes, required = true } = options;

  // Check if file exists
  if (!file) {
    if (required) {
      throw new FileUploadError('No file provided. Please select a file to upload.');
    }
    throw new AppError('No file provided', 400, ErrorCode.BAD_REQUEST);
  }

  // Check file size
  const maxBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new FileUploadError(
      `File size (${(file.size / (1024 * 1024)).toFixed(2)}MB) exceeds maximum allowed size of ${maxSizeMB}MB`
    );
  }

  // Check file type
  if (allowedTypes && allowedTypes.length > 0) {
    const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
    const mimeType = file.mimetype;
    
    const isAllowed = allowedTypes.some(type => {
      // Check by extension or mime type
      return type === `.${fileExtension}` || 
             type === fileExtension || 
             type === mimeType ||
             (type.includes('*') && mimeType.startsWith(type.replace('*', '')));
    });

    if (!isAllowed) {
      throw new FileUploadError(
        `File type not allowed. Accepted types: ${allowedTypes.join(', ')}`
      );
    }
  }

  return file;
}

/**
 * Image generation error handler
 */
export async function handleImageGeneration<T>(
  operation: () => Promise<T>,
  fallbackImageUrl?: string
): Promise<T | { url: string }> {
  try {
    return await operation();
  } catch (error: any) {
    console.error('Image generation failed:', error);
    
    if (fallbackImageUrl) {
      return { url: fallbackImageUrl } as any;
    }
    
    throw new ExternalAPIError(
      'Image Generation',
      'Failed to generate image. Please try again later.',
      true,
      { originalError: error.message },
      error
    );
  }
}

/**
 * Search query error handler with sanitization
 */
export function handleSearchQuery(
  query: string | undefined,
  options: {
    minLength?: number;
    maxLength?: number;
    required?: boolean;
  } = {}
): string {
  const { minLength = 1, maxLength = 200, required = true } = options;

  if (!query || query.trim().length === 0) {
    if (required) {
      throw new AppError('Search query is required', 400, ErrorCode.VALIDATION_ERROR);
    }
    return '';
  }

  const sanitizedQuery = query.trim();

  if (sanitizedQuery.length < minLength) {
    throw new AppError(
      `Search query must be at least ${minLength} characters`,
      400,
      ErrorCode.VALIDATION_ERROR
    );
  }

  if (sanitizedQuery.length > maxLength) {
    throw new AppError(
      `Search query must not exceed ${maxLength} characters`,
      400,
      ErrorCode.VALIDATION_ERROR
    );
  }

  // Sanitize SQL injection attempts
  const dangerous = ['--', ';', '/*', '*/', 'xp_', 'sp_', 'exec', 'execute', 'drop', 'truncate'];
  const lowerQuery = sanitizedQuery.toLowerCase();
  
  for (const pattern of dangerous) {
    if (lowerQuery.includes(pattern)) {
      throw new AppError(
        'Invalid characters in search query',
        400,
        ErrorCode.VALIDATION_ERROR
      );
    }
  }

  return sanitizedQuery;
}

/**
 * Email sending error handler with retry
 */
export async function handleEmailSend<T>(
  operation: () => Promise<T>,
  fallbackAction?: () => void
): Promise<T | void> {
  try {
    return await withRetry(operation, {
      maxRetries: 3,
      retryDelay: 1000,
      backoffMultiplier: 2,
      onRetry: (attempt, error) => {
        console.log(`Email send retry attempt ${attempt}:`, error.message);
      }
    });
  } catch (error: any) {
    console.error('Email send failed after retries:', error);
    
    // Execute fallback action if provided (e.g., add to queue for later)
    if (fallbackAction) {
      fallbackAction();
      return;
    }
    
    throw new ExternalAPIError(
      'Email Service',
      'Failed to send email. Please try again later.',
      false,
      { originalError: error.message },
      error
    );
  }
}

/**
 * Session validation error handler
 */
export function handleSessionValidation(
  req: any,
  requireAuth = true
): { userId?: string; isAuthenticated: boolean } {
  const session = req.session;
  
  if (!session) {
    if (requireAuth) {
      throw new AppError('Session not found', 401, ErrorCode.SESSION_EXPIRED);
    }
    return { isAuthenticated: false };
  }

  if (requireAuth && !session.userId) {
    throw new AppError('Authentication required', 401, ErrorCode.UNAUTHORIZED);
  }

  return {
    userId: session.userId,
    isAuthenticated: !!session.userId
  };
}

/**
 * API timeout wrapper
 */
export async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs = 30000,
  timeoutMessage = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    operation(),
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new AppError(timeoutMessage, 504, ErrorCode.GATEWAY_TIMEOUT)), timeoutMs)
    )
  ]);
}

/**
 * Batch operation error handler with partial success support
 */
export async function handleBatchOperation<T, R>(
  items: T[],
  operation: (item: T) => Promise<R>,
  options: {
    continueOnError?: boolean;
    maxConcurrent?: number;
  } = {}
): Promise<{ 
  successful: R[]; 
  failed: Array<{ item: T; error: string }>;
  totalProcessed: number;
}> {
  const { continueOnError = true, maxConcurrent = 5 } = options;
  const successful: R[] = [];
  const failed: Array<{ item: T; error: string }> = [];
  
  // Process in batches
  for (let i = 0; i < items.length; i += maxConcurrent) {
    const batch = items.slice(i, i + maxConcurrent);
    const promises = batch.map(async (item) => {
      try {
        const result = await operation(item);
        successful.push(result);
      } catch (error: any) {
        if (continueOnError) {
          failed.push({ item, error: error.message || 'Unknown error' });
        } else {
          throw error;
        }
      }
    });
    
    await Promise.all(promises);
  }
  
  return {
    successful,
    failed,
    totalProcessed: successful.length + failed.length
  };
}

/**
 * Content enrichment error handler with partial data fallback
 */
export async function handleEnrichmentRequest<T>(
  operation: () => Promise<T>,
  partialData?: Partial<T>
): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    console.warn('Enrichment failed, using partial data:', error.message);
    
    if (partialData) {
      // Return partial data as fallback
      return { ...partialData } as T;
    }
    
    throw new ExternalAPIError(
      'Enrichment Service',
      'Failed to enrich content. Basic data will be used.',
      false,
      { originalError: error.message },
      error
    );
  }
}