/**
 * Debug helpers for better error detection and logging
 */

export function validateStudyData(data: any): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!data.title || typeof data.title !== "string") {
    errors.push("Title is required and must be a string");
  }

  if (!data.abstract || typeof data.abstract !== "string") {
    errors.push("Abstract is required and must be a string");
  }

  if (data.doi && typeof data.doi !== "string") {
    errors.push("DOI must be a string");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function logRequestDetails(req: any, label: string = "Request") {
  console.log(`${label} Debug:`, {
    url: req.url,
    method: req.method,
    params: req.params,
    query: req.query,
    body: req.body,
    headers: req.headers,
    timestamp: new Date().toISOString(),
  });
}

export function validateDatabaseResult(
  result: any,
  expectedFields: string[],
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!result) {
    errors.push("Database result is null or undefined");
    return { isValid: false, errors };
  }

  for (const field of expectedFields) {
    if (!(field in result)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function debugApiCall(endpoint: string, data: any) {
  console.log(`API Call to ${endpoint}:`, {
    timestamp: new Date().toISOString(),
    data: JSON.stringify(data, null, 2),
    dataType: typeof data,
    isArray: Array.isArray(data),
  });
}
