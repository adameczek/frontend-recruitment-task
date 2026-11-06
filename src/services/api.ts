// Mock API Service
// Simulates backend calls with artificial delays
// Marcus: "In production these hit our real pricing engine"

import type {
  Configuration,
  PriceResponse,
  ValidationResult,
  PreviewResponse,
  Draft,
  Product,
} from '../components/ProductConfigurator/types';
import { calculatePriceBreakdown } from '../utils/pricing';

// Simulate network latency - varies to mimic real conditions
const randomDelay = (min: number, max: number): Promise<void> => {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, delay));
};

// Track request IDs for debugging (and to create the race condition bug)
let requestCounter = 0;

/**
 * Calculate price for a configuration
 * Returns pricing breakdown after "server-side" calculation
 */
export async function calculatePrice(
  config: Configuration,
  product: Product,
): Promise<PriceResponse> {
  const requestId = ++requestCounter;

  // Simulate variable network latency (this is intentional for the race condition bug)
  // Sometimes fast, sometimes slow - creates out-of-order responses
  await randomDelay(150, 800);

  const breakdown = calculatePriceBreakdown(config, product);

  return {
    breakdown,
    formattedTotal: formatCurrency(breakdown.total, product.currency),
    timestamp: requestId,
  };
}

/**
 * Validate a configuration for conflicts and issues
 */
export async function validateConfiguration(
  config: Configuration,
  product: Product,
): Promise<ValidationResult> {
  await randomDelay(50, 150);

  const errors: ValidationResult['errors'] = [];
  const warnings: ValidationResult['warnings'] = [];

  // Check for dependency violations
  for (const option of product.options) {
    if (option.dependsOn) {
      const dependencyValue = config.selections[option.dependsOn.optionId];
      const currentValue = config.selections[option.id];

      if (currentValue && dependencyValue !== option.dependsOn.requiredValue) {
        errors.push({
          code: 'VALIDATION_CONFLICT_47',
          message: `${option.name} requires ${option.dependsOn.optionId} to be ${option.dependsOn.requiredValue}`,
          optionId: option.id,
        });
      }
    }
  }

  // Check add-on dependencies
  for (const addOnId of config.addOns) {
    const addOn = product.addOns.find((a) => a.id === addOnId);
    if (addOn?.dependsOn) {
      const dependencyValue = config.selections[addOn.dependsOn.optionId];
      if (dependencyValue !== addOn.dependsOn.requiredValue) {
        errors.push({
          code: 'ERR_DEP_MISSING_47',
          message: `${addOn.name} requires ${addOn.dependsOn.optionId}`,
          optionId: addOnId,
        });
      }
    }
  }

  // Check quantity limits
  if (config.quantity < 1) {
    errors.push({
      code: 'ERR_INVALID_QTY',
      message: 'Quantity must be at least 1',
    });
  }

  // Warning for high quantities (might want review)
  if (config.quantity > 47) {
    warnings.push({
      code: 'WARN_HIGH_QTY',
      message: 'Large orders may require additional processing time',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Generate a preview image URL for the current configuration
 */
export async function generatePreview(
  config: Configuration,
  product: Product,
): Promise<PreviewResponse> {
  await randomDelay(100, 300);

  // In a real implementation, this would composite images based on selections
  // For now, just return the base product image with a cache-busting param
  const timestamp = Date.now();

  return {
    imageUrl: `${product.imageUrl}?config=${config.id}&t=${timestamp}`,
    generatedAt: timestamp,
  };
}

/**
 * Save a draft configuration to localStorage
 */
export async function saveDraft(config: Configuration, name: string): Promise<Draft> {
  // Wrap in promise to maintain async interface (production would be async)
  return new Promise((resolve) => {
    const draft: Draft = {
      id: `draft_${Date.now()}`,
      configuration: { ...config },
      savedAt: new Date().toISOString(),
      name: name || `Draft ${new Date().toLocaleTimeString()}`,
    };

    // Get existing drafts
    const existingDrafts = getDraftsFromStorage();

    // Add new draft (limit to 10 most recent)
    const updatedDrafts = [draft, ...existingDrafts].slice(0, 10);

    localStorage.setItem('configureflow_drafts', JSON.stringify(updatedDrafts));

    resolve(draft);
  });
}

/**
 * Load a draft by ID
 */
export async function loadDraft(draftId: string): Promise<Draft | null> {
  return new Promise((resolve) => {
    const drafts = getDraftsFromStorage();
    const draft = drafts.find((d) => d.id === draftId);
    resolve(draft || null);
  });
}

/**
 * Get all saved drafts
 */
export async function getAllDrafts(): Promise<Draft[]> {
  return new Promise((resolve) => {
    resolve(getDraftsFromStorage());
  });
}

/**
 * Delete a draft by ID
 */
export async function deleteDraft(draftId: string): Promise<boolean> {
  return new Promise((resolve) => {
    const drafts = getDraftsFromStorage();
    const filtered = drafts.filter((d) => d.id !== draftId);

    if (filtered.length !== drafts.length) {
      localStorage.setItem('configureflow_drafts', JSON.stringify(filtered));
      resolve(true);
    } else {
      resolve(false);
    }
  });
}

// Helper: Get drafts from localStorage
function getDraftsFromStorage(): Draft[] {
  try {
    const stored = localStorage.getItem('configureflow_drafts');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// Helper: Format currency
function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

/**
 * Encode configuration to URL-safe string
 */
export function encodeConfigurationToUrl(config: Configuration): string {
  const data = JSON.stringify({
    s: config.selections,
    a: config.addOns,
    q: config.quantity,
    n: config.name,
  });

  return btoa(data);
}

/**
 * Decode configuration from URL string
 */
export function decodeConfigurationFromUrl(encoded: string): Partial<Configuration> | null {
  try {
    const data = JSON.parse(atob(encoded));
    return {
      selections: data.s || {},
      addOns: data.a || [],
      quantity: data.q || 1,
      name: data.n,
    };
  } catch (e) {
    console.error('Failed to decode configuration:', e);
    return null;
  }
}
