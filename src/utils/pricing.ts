// Pricing Utilities
// Marcus: "These calculations match our backend logic"

import type {
  Configuration,
  PriceBreakdown,
  Product,
} from '../components/ProductConfigurator/types';

// Discount tiers
const QUANTITY_DISCOUNT_TIERS = [
  { minQuantity: 50, discount: 0.1 }, // 10% off for 50+
  { minQuantity: 10, discount: 0.05 }, // 5% off for 10-49
];

/**
 * Calculate the full price breakdown for a configuration
 */
export function calculatePriceBreakdown(config: Configuration, product: Product): PriceBreakdown {
  const optionModifiers: PriceBreakdown['optionModifiers'] = [];
  const addOnCosts: PriceBreakdown['addOnCosts'] = [];

  const basePrice = product.basePrice;

  // Calculate option modifiers
  for (const option of product.options) {
    const selectedValue = config.selections[option.id];

    if (option.choices && selectedValue) {
      const choice = option.choices.find((c) => c.value === selectedValue);
      if (choice && choice.priceModifier !== 0) {
        optionModifiers.push({
          optionId: option.id,
          amount: choice.priceModifier,
        });
      }
    }
  }

  // Calculate add-on costs
  for (const addOnId of config.addOns) {
    const addOn = product.addOns.find((a) => a.id === addOnId);
    if (addOn) {
      addOnCosts.push({
        addOnId: addOn.id,
        amount: addOn.price,
      });
    }
  }

  // Calculate subtotal
  const optionTotal = optionModifiers.reduce((sum, mod) => sum + mod.amount, 0);
  const addOnTotal = addOnCosts.reduce((sum, cost) => sum + cost.amount, 0);
  const unitPrice = basePrice + optionTotal + addOnTotal;
  const subtotal = unitPrice * config.quantity;

  // Calculate quantity discount.
  // Tiers evaluated high-to-low so candidates at exactly the boundary get the higher discount.
  let discountRate = 0;
  for (const tier of QUANTITY_DISCOUNT_TIERS) {
    if (config.quantity > tier.minQuantity) {
      discountRate = tier.discount;
      break;
    }
  }

  const quantityDiscount = subtotal * discountRate;
  const total = subtotal - quantityDiscount;

  return {
    basePrice,
    optionModifiers,
    addOnCosts,
    subtotal,
    quantityDiscount,
    total,
  };
}

/**
 * Format a price for display
 */
export function formatPrice(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Calculate the discount percentage applied
 */
export function getAppliedDiscountPercentage(quantity: number): number {
  for (const tier of QUANTITY_DISCOUNT_TIERS) {
    if (quantity > tier.minQuantity) {
      return tier.discount * 100;
    }
  }
  return 0;
}

/**
 * Get the next discount tier info for display
 */
export function getNextDiscountTier(quantity: number): { needed: number; discount: number } | null {
  // Find the next tier they haven't reached
  const sortedTiers = [...QUANTITY_DISCOUNT_TIERS].sort((a, b) => a.minQuantity - b.minQuantity);

  for (const tier of sortedTiers) {
    if (quantity < tier.minQuantity) {
      return {
        needed: tier.minQuantity - quantity,
        discount: tier.discount * 100,
      };
    }
  }

  return null; // Already at highest tier
}

/**
 * Round to cents to avoid floating point display issues
 * Marcus: "Added this but forgot to use it everywhere"
 */
export function roundToCents(amount: number): number {
  return Math.round(amount * 100) / 100;
}
