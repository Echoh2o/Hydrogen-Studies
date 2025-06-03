import { ZodError } from "zod";

/**
 * Simple error handler to replace zod-validation-error dependency
 * Fixes deployment module resolution issues
 */
export function formatZodError(error: ZodError): string {
  const issues = error.issues.map(issue => {
    const path = issue.path.length > 0 ? ` at ${issue.path.join('.')}` : '';
    return `${issue.message}${path}`;
  });
  
  return `Validation failed: ${issues.join(', ')}`;
}

export function handleValidationError(error: unknown) {
  if (error instanceof ZodError) {
    return {
      success: false,
      message: formatZodError(error)
    };
  }
  
  return {
    success: false,
    message: error instanceof Error ? error.message : 'Unknown validation error'
  };
}