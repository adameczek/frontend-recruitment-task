// ProductConfigurator Types
// Last updated by Marcus - "I think this covers everything we need"

export interface Product {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  currency: string;
  options: ProductOption[];
  addOns: AddOn[];
  imageUrl: string;
}

export type OptionType = 'select' | 'color' | 'quantity' | 'toggle';

export interface ProductOption {
  id: string;
  name: string;
  type: OptionType;
  required: boolean;
  choices?: OptionChoice[];
  defaultValue?: string | number | boolean;
  min?: number;
  max?: number;
  dependsOn?: OptionDependency;
}

export interface OptionChoice {
  id: string;
  label: string;
  value: string;
  priceModifier: number;
  colorHex?: string;
  available: boolean;
  imageOverlay?: string;
}

export interface OptionDependency {
  optionId: string;
  requiredValue: string | boolean;
}

export interface AddOn {
  id: string;
  name: string;
  description: string;
  price: number;
  dependsOn?: OptionDependency;
}

export interface Configuration {
  id: string;
  productId: string;
  selections: Record<string, string | number | boolean>;
  addOns: string[];
  quantity: number;
  createdAt: string;
  updatedAt: string;
  name?: string;
}

export interface PriceBreakdown {
  basePrice: number;
  optionModifiers: { optionId: string; amount: number }[];
  addOnCosts: { addOnId: string; amount: number }[];
  subtotal: number;
  quantityDiscount: number;
  total: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  message: string;
  optionId?: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
  optionId?: string;
}

export interface Draft {
  id: string;
  configuration: Configuration;
  savedAt: string;
  name: string;
}

// API Response types
export interface PriceResponse {
  breakdown: PriceBreakdown;
  formattedTotal: string;
  timestamp: number;
}

export interface PreviewResponse {
  imageUrl: string;
  generatedAt: number;
}

// Component Props
export interface ProductConfiguratorProps {
  product: Product;
  initialConfiguration?: Partial<Configuration>;
  onConfigurationChange?: (config: Configuration) => void;
  onAddToCart?: (config: Configuration, price: PriceBreakdown) => void;
  readOnly?: boolean;
}

// Internal state types
export interface ConfiguratorState {
  selections: Record<string, string | number | boolean>;
  addOns: string[];
  quantity: number;
  isDirty: boolean;
  lastSaved: Date | null;
}

// Error codes - Marcus: "The numbers don't mean anything specific, just legacy stuff"
export const ERROR_CODES = {
  PRICE_CALC_FAILED: 'ERR_PRICE_CALC_FAILED',
  VALIDATION_CONFLICT: 'VALIDATION_CONFLICT_47',
  NETWORK_TIMEOUT: 'ERR_NETWORK_TIMEOUT_PRICE',
  INVALID_QUANTITY: 'ERR_INVALID_QTY',
  DEPENDENCY_MISSING: 'ERR_DEP_MISSING_47',
  UNKNOWN: 'ERR_UNKNOWN',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

// Event types for callbacks
export interface ConfigChangeEvent {
  type: 'option' | 'addon' | 'quantity';
  optionId?: string;
  addOnId?: string;
  previousValue: any;
  newValue: any;
}
