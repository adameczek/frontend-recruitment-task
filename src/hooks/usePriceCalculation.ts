// usePriceCalculation Hook
// Marcus: "This hook handles async price fetching. A bit janky but works."

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  Configuration,
  Product,
  PriceBreakdown,
  PriceResponse,
} from '../components/ProductConfigurator/types';
import { calculatePrice } from '../services/api';

interface UsePriceCalculationResult {
  price: PriceBreakdown | null;
  formattedTotal: string;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Custom hook for managing price calculation
 */
export function usePriceCalculation(
  config: Configuration | null,
  product: Product,
): UsePriceCalculationResult {
  const [result, setResult] = useState<{
    price: PriceBreakdown | null;
    formattedTotal: string;
    error: string | null;
  }>({
    price: null,
    formattedTotal: '$0.00',
    error: null,
  });

  // Fingerprint of the configuration we most recently finished fetching for.
  // Used to derive `isLoading` during render instead of setting it imperatively.
  const [settledKey, setSettledKey] = useState<string | null>(null);

  // Hold the in-flight request so we can cancel it when a newer one starts
  // or the component unmounts. Prevents stale responses from overwriting newer ones.
  const abortControllerRef = useRef<AbortController | null>(null);

  const configKey = config
    ? JSON.stringify([config.selections, config.addOns, config.quantity])
    : null;

  const fetchPrice = useCallback(() => {
    // Cancel any in-flight request before starting a new one.
    abortControllerRef.current?.abort();

    if (!config) {
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    calculatePrice(config, product, controller.signal)
      .then((response: PriceResponse) => {
        if (!controller.signal.aborted) {
          setResult({
            price: response.breakdown,
            formattedTotal: response.formattedTotal,
            error: null,
          });
          setSettledKey(configKey);
        }
      })
      .catch(() => {
        // Ignore aborted requests; only surface real failures.
        if (!controller.signal.aborted) {
          setResult({
            price: null,
            formattedTotal: '$0.00',
            error: 'ERR_PRICE_CALC_FAILED',
          });
          setSettledKey(configKey);
        }
      });
  }, [config, product, configKey]);

  // Fetch price when config changes
  useEffect(() => {
    fetchPrice();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [fetchPrice]);

  if (!config) {
    return {
      price: null,
      formattedTotal: '$0.00',
      isLoading: false,
      error: null,
      refetch: fetchPrice,
    };
  }

  return {
    price: result.price,
    formattedTotal: result.formattedTotal,
    isLoading: settledKey !== configKey,
    error: settledKey === configKey ? result.error : null,
    refetch: fetchPrice,
  };
}
