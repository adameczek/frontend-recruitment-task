/**
 * ProductConfigurator Component
 *
 * The main configurator widget for customizing products.
 * This component handles all product configuration logic including:
 * - Option selection (dropdowns, colors, toggles)
 * - Quantity management
 * - Add-on selection
 * - Price calculation
 * - Draft saving/loading
 * - Share URL generation
 *
 * Author: Marcus (no longer with company)
 * Last updated: 2 weeks ago
 *
 * Known issues:
 * - "Some timing stuff with prices, meant to fix" - Marcus
 * - "Resize handler might have a leak" - Marcus
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type {
  Product,
  ProductOption,
  OptionChoice,
  AddOn,
  Configuration,
  PriceBreakdown,
  Draft,
  ValidationResult,
} from './types';
import { ERROR_CODES } from './types';
import { usePriceCalculation } from '../../hooks/usePriceCalculation';
import {
  validateConfiguration,
  saveDraft,
  loadDraft,
  getAllDrafts,
  deleteDraft,
  encodeConfigurationToUrl,
  decodeConfigurationFromUrl,
  generatePreview,
} from '../../services/api';
import {
  formatPrice,
  getAppliedDiscountPercentage,
  getNextDiscountTier,
} from '../../utils/pricing';
import { getUserFriendlyErrorMessage } from '../../utils/errorMessages';
import './styles.css';

interface ProductConfiguratorProps {
  product: Product;
  initialConfiguration?: Partial<Configuration>;
  onConfigurationChange?: (config: Configuration) => void;
  onAddToCart?: (config: Configuration, price: PriceBreakdown) => void;
  readOnly?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

const generateConfigId = (): string => {
  return `config_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const getConfigFromUrl = (): Partial<Configuration> | null => {
  const params = new URLSearchParams(window.location.search);
  const encodedConfig = params.get('config');
  if (!encodedConfig) return null;
  return decodeConfigurationFromUrl(encodedConfig);
};

const getDefaultSelections = (product: Product): Record<string, string | number | boolean> => {
  const selections: Record<string, string | number | boolean> = {};

  for (const option of product.options) {
    if (option.defaultValue !== undefined) {
      selections[option.id] = option.defaultValue;
    } else if (option.choices && option.choices.length > 0) {
      const firstAvailable = option.choices.find((c) => c.available);
      if (firstAvailable) {
        selections[option.id] = firstAvailable.value;
      }
    }
  }

  return selections;
};

const isAddOnAvailable = (
  addOn: AddOn,
  selections: Record<string, string | number | boolean>,
): boolean => {
  if (!addOn.dependsOn) return true;

  const dependencyValue = selections[addOn.dependsOn.optionId];
  return dependencyValue === addOn.dependsOn.requiredValue;
};

const formatTimestamp = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleString();
};

const calculateColorColumns = (
  containerWidth: number,
  swatchSize: number = 36,
  gap: number = 8,
): number => {
  const columns = Math.floor((containerWidth + gap) / (swatchSize + gap));
  return Math.max(1, columns);
};

const getFocusableElements = (container: HTMLElement | null): HTMLElement[] => {
  if (!container) return [];
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => !el.hasAttribute('disabled'));
};

// ============================================================================
// Main Component
// ============================================================================

export const ProductConfigurator: React.FC<ProductConfiguratorProps> = ({
  product,
  initialConfiguration,
  onConfigurationChange,
  onAddToCart,
  readOnly = false,
}) => {
  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  const [selections, setSelections] = useState<Record<string, string | number | boolean>>(
    () =>
      getConfigFromUrl()?.selections ||
      initialConfiguration?.selections ||
      getDefaultSelections(product),
  );

  const [selectedAddOns, setSelectedAddOns] = useState<string[]>(
    () => getConfigFromUrl()?.addOns || initialConfiguration?.addOns || [],
  );

  const [quantity, setQuantity] = useState<number>(
    () => getConfigFromUrl()?.quantity || initialConfiguration?.quantity || 1,
  );

  const [configId] = useState<string>(() => initialConfiguration?.id || generateConfigId());

  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [draftName, setDraftName] = useState('');

  const [showDraftModal, setShowDraftModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showUnsavedChangesModal, setShowUnsavedChangesModal] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);

  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [isValid, setIsValid] = useState(false);

  const [previewUrl, setPreviewUrl] = useState<string>(product.imageUrl);

  const [error, setError] = useState<string | null>(null);

  const [shareUrl, setShareUrl] = useState<string>('');

  const containerRef = useRef<HTMLDivElement>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const lastFocusedElement = useRef<HTMLElement | null>(null);
  const draftModalRef = useRef<HTMLDivElement>(null);
  const shareModalRef = useRef<HTMLDivElement>(null);
  const unsavedChangesModalRef = useRef<HTMLDivElement>(null);

  // -------------------------------------------------------------------------
  // Derived State
  // -------------------------------------------------------------------------

  const currentConfig: Configuration = useMemo(
    () => ({
      id: configId,
      productId: product.id,
      selections,
      addOns: selectedAddOns,
      quantity,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      name: draftName || undefined,
    }),
    [configId, product.id, selections, selectedAddOns, quantity, draftName],
  );

  const {
    price,
    formattedTotal,
    isLoading: isPriceLoading,
    error: priceError,
  } = usePriceCalculation(currentConfig, product);

  const appliedDiscount = getAppliedDiscountPercentage(quantity);
  const nextTier = getNextDiscountTier(quantity);

  // -------------------------------------------------------------------------
  // Effects
  // -------------------------------------------------------------------------

  useEffect(() => {
    const handleResize = () => {
      if (colorPickerRef.current) {
        const width = colorPickerRef.current.offsetWidth;
        const cols = calculateColorColumns(width);
        colorPickerRef.current.style.setProperty('--color-columns', cols.toString());
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const validate = async () => {
      try {
        const result = await validateConfiguration(currentConfig, product);
        if (!cancelled) {
          setValidation(result);
          setIsValid(true);
        }
      } catch {
        if (!cancelled) {
          setIsValid(false);
        }
      }
    };

    validate();

    return () => {
      cancelled = true;
    };
  }, [currentConfig, product]);

  useEffect(() => {
    const controller = new AbortController();

    const updatePreview = async () => {
      try {
        const preview = await generatePreview(currentConfig, product, controller.signal);
        if (!controller.signal.aborted) {
          setPreviewUrl(preview.imageUrl);
        }
      } catch {
        if (!controller.signal.aborted) {
          setPreviewUrl(product.imageUrl);
        }
      }
    };

    updatePreview();

    return () => {
      controller.abort();
    };
  }, [currentConfig, product]);

  useEffect(() => {
    if (onConfigurationChange) {
      onConfigurationChange(currentConfig);
    }
  }, [onConfigurationChange, currentConfig]);

  useEffect(() => {
    if (showDraftModal) {
      getAllDrafts().then(setDrafts);
    }
  }, [showDraftModal]);

  useEffect(() => {
    if (showDraftModal) {
      getFocusableElements(draftModalRef.current)[0]?.focus();
    }
  }, [showDraftModal]);

  useEffect(() => {
    if (showShareModal) {
      getFocusableElements(shareModalRef.current)[0]?.focus();
    }
  }, [showShareModal]);

  useEffect(() => {
    if (showUnsavedChangesModal) {
      getFocusableElements(unsavedChangesModalRef.current)[0]?.focus();
    }
  }, [showUnsavedChangesModal]);

  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // -------------------------------------------------------------------------
  // Event Handlers
  // -------------------------------------------------------------------------

  const handleOptionChange = useCallback(
    (optionId: string, value: string | number | boolean) => {
      setError(null);
      setSelections((prev) => ({
        ...prev,
        [optionId]: value,
      }));

      // Clean up any dependent add-ons whose requirement is no longer met.
      // This applies to every option type (e.g. toggles like "Include Packaging").
      const dependentAddOnIds = new Set(
        product.addOns
          .filter((a) => a.dependsOn?.optionId === optionId)
          .filter((a) => a.dependsOn && value !== a.dependsOn.requiredValue)
          .map((a) => a.id),
      );

      if (dependentAddOnIds.size > 0) {
        setSelectedAddOns((prev) => prev.filter((id) => !dependentAddOnIds.has(id)));
      }

      setIsDirty(true);
    },
    [product.addOns],
  );

  const handleAddOnToggle = useCallback(
    (addOnId: string) => {
      const addOn = product.addOns.find((a) => a.id === addOnId);
      if (!addOn) return;

      if (!isAddOnAvailable(addOn, selections)) {
        setError(ERROR_CODES.DEPENDENCY_MISSING);
        return;
      }

      setError(null);

      setSelectedAddOns((prev) => {
        if (prev.includes(addOnId)) {
          return prev.filter((id) => id !== addOnId);
        } else {
          return [...prev, addOnId];
        }
      });

      setIsDirty(true);
    },
    [product.addOns, selections],
  );

  const handleQuantityChange = useCallback(
    (newQuantity: number) => {
      setError(null);
      const quantityOption = product.options.find((o) => o.type === 'quantity');
      const min = quantityOption?.min ?? 1;
      const max = quantityOption?.max ?? 999;

      const clampedQuantity = Math.max(min, Math.min(max, newQuantity));
      setQuantity(clampedQuantity);
      setIsDirty(true);
    },
    [product.options],
  );

  const handleSaveDraft = useCallback(async () => {
    setError(null);
    try {
      await saveDraft(currentConfig, draftName || 'Untitled Draft');
      setLastSaved(new Date());
      setIsDirty(false);
      setDraftName('');

      setShowDraftModal(false);
    } catch {
      setError(ERROR_CODES.UNKNOWN);
    }
  }, [currentConfig, draftName]);

  const handleLoadDraft = useCallback(async (draftId: string) => {
    setError(null);
    try {
      const draft = await loadDraft(draftId);
      if (draft) {
        setSelections(draft.configuration.selections);
        setSelectedAddOns(draft.configuration.addOns);
        setQuantity(draft.configuration.quantity);
        setShowDraftModal(false);
        setIsDirty(false);
      }
    } catch {
      setError(ERROR_CODES.UNKNOWN);
    }
  }, []);

  const handleDeleteDraft = useCallback(async (draftId: string) => {
    setError(null);
    try {
      await deleteDraft(draftId);
      setDrafts((prev) => prev.filter((d) => d.id !== draftId));
    } catch {
      setError(ERROR_CODES.UNKNOWN);
    }
  }, []);

  const handleAddToCart = useCallback(() => {
    if (!validation?.valid) {
      setError(validation?.errors[0]?.code || ERROR_CODES.UNKNOWN);
      return;
    }

    setError(null);
    if (price && onAddToCart) {
      onAddToCart(currentConfig, price);
    }
  }, [validation, price, currentConfig, onAddToCart]);

  const handleQuickAdd = useCallback(() => {
    if (price && onAddToCart) {
      onAddToCart(currentConfig, price);
    }
  }, [price, currentConfig, onAddToCart]);

  const handleCopyShareUrl = useCallback(() => {
    setError(null);
    navigator.clipboard
      .writeText(shareUrl)
      .then(() => {})
      .catch(() => {
        setError(ERROR_CODES.UNKNOWN);
      });
  }, [shareUrl]);

  const handleOpenShareModal = useCallback(() => {
    lastFocusedElement.current = document.activeElement as HTMLElement;
    const encoded = encodeConfigurationToUrl(currentConfig);
    const url = `${window.location.origin}${window.location.pathname}?config=${encoded}`;
    setShareUrl(url);
    setShowShareModal(true);
  }, [currentConfig]);

  const handleModalClose = useCallback((modalType: 'draft' | 'share' | 'unsaved') => {
    if (modalType === 'draft') {
      setShowDraftModal(false);
    } else if (modalType === 'share') {
      setShowShareModal(false);
    } else {
      setShowUnsavedChangesModal(false);
    }

    if (lastFocusedElement.current) {
      lastFocusedElement.current.focus();
    }
  }, []);

  const handleModalKeyDown = useCallback(
    (
      e: React.KeyboardEvent,
      modalType: 'draft' | 'share' | 'unsaved',
      container: HTMLElement | null,
    ) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleModalClose(modalType);
        return;
      }

      if (e.key !== 'Tab') return;

      const focusables = getFocusableElements(container);
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (!container?.contains(active)) {
        e.preventDefault();
        first.focus();
        return;
      }

      if (e.shiftKey) {
        if (active === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [handleModalClose],
  );

  const handleColorKeyDown = useCallback(
    (
      e: React.KeyboardEvent<HTMLDivElement>,
      option: ProductOption,
      index: number,
      choices: OptionChoice[],
    ) => {
      const handledKeys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End', ' '];
      if (!handledKeys.includes(e.key)) return;

      e.preventDefault();

      if (e.key === ' ') {
        if (!readOnly) handleOptionChange(option.id, choices[index].value);
        return;
      }

      const radios = Array.from(
        e.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="radio"]') ?? [],
      );
      if (radios.length === 0) return;

      const currentIndex = radios.indexOf(e.currentTarget);
      let nextIndex: number;

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          nextIndex = (currentIndex + 1) % radios.length;
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          nextIndex = (currentIndex - 1 + radios.length) % radios.length;
          break;
        case 'Home':
          nextIndex = 0;
          break;
        default:
          nextIndex = radios.length - 1;
          break;
      }

      const targetChoice = choices[nextIndex];
      if (targetChoice && !readOnly) {
        handleOptionChange(option.id, targetChoice.value);
      }
      radios[nextIndex]?.focus();
    },
    [handleOptionChange, readOnly],
  );

  const handleDiscardChanges = useCallback(() => {
    setSelections(getDefaultSelections(product));
    setSelectedAddOns([]);
    setQuantity(1);
    setIsDirty(false);
    setShowUnsavedChangesModal(false);
  }, [product]);

  const handleSaveAndClose = useCallback(async () => {
    setError(null);
    try {
      await saveDraft(currentConfig, draftName || 'Untitled Draft');
      setLastSaved(new Date());
      setDraftName('');
      setSelections(getDefaultSelections(product));
      setSelectedAddOns([]);
      setQuantity(1);
      setIsDirty(false);
      setShowUnsavedChangesModal(false);
    } catch {
      setError(ERROR_CODES.UNKNOWN);
    }
  }, [currentConfig, draftName, product]);

  // -------------------------------------------------------------------------
  // Render Helpers
  // -------------------------------------------------------------------------

  const renderSelectOption = (option: ProductOption) => {
    const currentValue = selections[option.id] as string;

    return (
      <div className="option-group" key={option.id}>
        <label className="option-label" htmlFor={`option-${option.id}`}>
          {option.name}
          {option.required && <span className="required">*</span>}
        </label>
        <select
          id={`option-${option.id}`}
          className="option-select"
          value={currentValue || ''}
          onChange={(e) => handleOptionChange(option.id, e.target.value)}
          disabled={readOnly}
        >
          {option.choices?.map((choice) => (
            <option key={choice.id} value={choice.value} disabled={!choice.available}>
              {choice.label}
              {choice.priceModifier !== 0 &&
                ` (${choice.priceModifier > 0 ? '+' : ''}${formatPrice(choice.priceModifier, product.currency)})`}
            </option>
          ))}
        </select>
      </div>
    );
  };

  const renderColorOption = (option: ProductOption) => {
    const currentValue = selections[option.id] as string;

    return (
      <div className="option-group" key={option.id}>
        <label className="option-label">
          {option.name}
          {option.required && <span className="required">*</span>}
        </label>
        <div
          className="color-picker"
          ref={colorPickerRef}
          role="radiogroup"
          aria-label={option.name}
        >
          {option.choices?.map((choice, index) => {
            const isSelected = currentValue === choice.value;
            const isTabStop = isSelected || (!currentValue && index === 0);
            return (
              <div
                key={choice.id}
                className={`color-swatch ${isSelected ? 'selected' : ''}`}
                style={{ backgroundColor: choice.colorHex }}
                onClick={() => !readOnly && handleOptionChange(option.id, choice.value)}
                title={choice.label}
                role="radio"
                aria-checked={isSelected}
                aria-label={choice.label}
                tabIndex={isTabStop ? 0 : -1}
                onKeyDown={(e) => handleColorKeyDown(e, option, index, option.choices ?? [])}
              />
            );
          })}
        </div>
      </div>
    );
  };

  const renderQuantityOption = (option: ProductOption) => {
    return (
      <div className="option-group" key={option.id}>
        <label className="option-label" htmlFor={`quantity-input`}>
          {option.name}
          {option.required && <span className="required">*</span>}
          {appliedDiscount > 0 && <span className="discount-badge">{appliedDiscount}% OFF</span>}
        </label>
        <div className="quantity-control">
          <button
            className="quantity-btn"
            onClick={() => handleQuantityChange(quantity - 1)}
            disabled={readOnly || quantity <= (option.min ?? 1)}
            aria-label="Decrease quantity"
          >
            −
          </button>
          <input
            id="quantity-input"
            type="number"
            className="quantity-input"
            value={quantity}
            onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
            min={option.min}
            max={option.max}
            disabled={readOnly}
          />
          <button
            className="quantity-btn"
            onClick={() => handleQuantityChange(quantity + 1)}
            disabled={readOnly || quantity >= (option.max ?? 999)}
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>
        {nextTier && (
          <p className="next-discount-hint">
            Add {nextTier.needed} more for {nextTier.discount}% discount!
          </p>
        )}
      </div>
    );
  };

  const renderToggleOption = (option: ProductOption) => {
    const currentValue = selections[option.id] as boolean;

    return (
      <div className="option-group" key={option.id}>
        <div className="toggle-control">
          <div
            className={`toggle-switch ${currentValue ? 'active' : ''}`}
            onClick={() => !readOnly && handleOptionChange(option.id, !currentValue)}
            role="switch"
            aria-checked={currentValue}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleOptionChange(option.id, !currentValue);
              }
            }}
          />
          <span className="toggle-label">{option.name}</span>
        </div>
      </div>
    );
  };

  const renderOption = (option: ProductOption) => {
    if (option.dependsOn) {
      const depValue = selections[option.dependsOn.optionId];
      if (depValue !== option.dependsOn.requiredValue) {
        return null;
      }
    }

    switch (option.type) {
      case 'select':
        return renderSelectOption(option);
      case 'color':
        return renderColorOption(option);
      case 'quantity':
        return renderQuantityOption(option);
      case 'toggle':
        return renderToggleOption(option);
      default:
        return null;
    }
  };

  const renderAddOn = (addOn: AddOn) => {
    const isSelected = selectedAddOns.includes(addOn.id);
    const isAvailable = isAddOnAvailable(addOn, selections);

    return (
      <div
        key={addOn.id}
        className={`addon-item ${isSelected ? 'selected' : ''} ${!isAvailable ? 'disabled' : ''}`}
        onClick={() => !readOnly && isAvailable && handleAddOnToggle(addOn.id)}
      >
        <input
          type="checkbox"
          className="addon-checkbox"
          checked={isSelected}
          onChange={() => {}}
          disabled={readOnly || !isAvailable}
        />
        <div className="addon-info">
          <div className="addon-name">{addOn.name}</div>
          <div className="addon-description">
            {addOn.description}
            {!isAvailable && addOn.dependsOn && (
              <span style={{ color: '#e74c3c' }}> (Requires {addOn.dependsOn.optionId})</span>
            )}
          </div>
        </div>
        <div className="addon-price">+{formatPrice(addOn.price, product.currency)}</div>
      </div>
    );
  };

  const renderPriceBreakdown = () => {
    if (!price) return null;

    return (
      <div className="price-breakdown">
        <div className="price-line">
          <span>Base price</span>
          <span>{formatPrice(price.basePrice, product.currency)}</span>
        </div>

        {price.optionModifiers.map((mod) => {
          const option = product.options.find((o) => o.id === mod.optionId);
          return (
            <div className="price-line" key={mod.optionId}>
              <span>{option?.name || mod.optionId}</span>
              <span>
                {mod.amount >= 0 ? '+' : ''}
                {formatPrice(mod.amount, product.currency)}
              </span>
            </div>
          );
        })}

        {price.addOnCosts.map((cost) => {
          const addOn = product.addOns.find((a) => a.id === cost.addOnId);
          return (
            <div className="price-line" key={cost.addOnId}>
              <span>{addOn?.name || cost.addOnId}</span>
              <span>+{formatPrice(cost.amount, product.currency)}</span>
            </div>
          );
        })}

        {quantity > 1 && (
          <div className="price-line">
            <span>Quantity ({quantity}×)</span>
            <span>{formatPrice(price.subtotal, product.currency)}</span>
          </div>
        )}

        {price.quantityDiscount > 0 && (
          <div className="price-line discount">
            <span>Volume discount ({appliedDiscount}%)</span>
            <span>-{formatPrice(price.quantityDiscount, product.currency)}</span>
          </div>
        )}

        <div className="price-line total">
          <span>Total</span>
          <span>{formatPrice(price.total, product.currency)}</span>
        </div>
      </div>
    );
  };

  const renderDraftModal = () => {
    if (!showDraftModal) return null;

    return (
      <div className="modal-overlay" onClick={() => handleModalClose('draft')}>
        <div
          className="modal"
          ref={draftModalRef}
          role="dialog"
          aria-modal="true"
          aria-label="Saved Drafts"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => handleModalKeyDown(e, 'draft', draftModalRef.current)}
        >
          <div className="modal-header">
            <h3 className="modal-title">Saved Drafts</h3>
            <button
              className="modal-close"
              onClick={() => handleModalClose('draft')}
              aria-label="Close modal"
            >
              ×
            </button>
          </div>
          <div className="modal-body">
            {drafts.length === 0 ? (
              <p>No saved drafts yet.</p>
            ) : (
              <ul className="draft-list">
                {drafts.map((draft) => (
                  <li key={draft.id} className="draft-list-item">
                    <div>
                      <div className="draft-item-name">{draft.name}</div>
                      <div className="draft-item-date">Saved: {formatTimestamp(draft.savedAt)}</div>
                    </div>
                    <div>
                      <button
                        className="btn btn-secondary"
                        onClick={() => handleLoadDraft(draft.id)}
                        style={{ marginRight: '8px' }}
                      >
                        Load
                      </button>
                      <button
                        className="btn btn-danger"
                        onClick={() => handleDeleteDraft(draft.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div
              style={{
                marginTop: '24px',
                paddingTop: '16px',
                borderTop: '1px solid #eee',
              }}
            >
              <h4>Save Current Configuration</h4>
              <input
                type="text"
                placeholder="Draft name (optional)"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  marginBottom: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                }}
              />
              <button className="btn btn-primary btn-block" onClick={handleSaveDraft}>
                Save Draft
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderShareModal = () => {
    if (!showShareModal) return null;

    return (
      <div className="modal-overlay" onClick={() => handleModalClose('share')}>
        <div
          className="modal"
          ref={shareModalRef}
          role="dialog"
          aria-modal="true"
          aria-label="Share Configuration"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => handleModalKeyDown(e, 'share', shareModalRef.current)}
        >
          <div className="modal-header">
            <h3 className="modal-title">Share Configuration</h3>
            <button
              className="modal-close"
              onClick={() => handleModalClose('share')}
              aria-label="Close modal"
            >
              ×
            </button>
          </div>
          <div className="modal-body">
            <p>Copy this link to share your configuration:</p>
            <input
              type="text"
              className="share-url-input"
              value={shareUrl}
              readOnly
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => handleModalClose('share')}>
              Close
            </button>
            <button className="btn btn-primary" onClick={handleCopyShareUrl}>
              Copy Link
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderUnsavedChangesModal = () => {
    if (!showUnsavedChangesModal) return null;

    return (
      <div className="modal-overlay" onClick={() => handleModalClose('unsaved')}>
        <div
          className="modal"
          ref={unsavedChangesModalRef}
          role="dialog"
          aria-modal="true"
          aria-label="Unsaved changes"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => handleModalKeyDown(e, 'unsaved', unsavedChangesModalRef.current)}
        >
          <div className="modal-header">
            <h3 className="modal-title">Unsaved Changes</h3>
            <button
              className="modal-close"
              onClick={() => handleModalClose('unsaved')}
              aria-label="Close modal"
            >
              x
            </button>
          </div>
          <div className="modal-body">
            <p>You have unsaved changes. What would you like to do?</p>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => handleModalClose('unsaved')}>
              Cancel
            </button>
            <button className="btn btn-danger" onClick={handleDiscardChanges}>
              Discard
            </button>
            <button className="btn btn-primary" onClick={handleSaveAndClose}>
              Save & Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Main Render
  // -------------------------------------------------------------------------

  return (
    <div className="configurator" ref={containerRef}>
      <div className="configurator-header">
        <div>
          <h1 className="configurator-title">{product.name}</h1>
          <p className="configurator-description">{product.description}</p>
        </div>
        <div className="configurator-actions">
          <button
            className="btn btn-secondary"
            onClick={() => {
              lastFocusedElement.current = document.activeElement as HTMLElement;
              setShowDraftModal(true);
            }}
          >
            Drafts
          </button>
          <button className="btn btn-secondary" onClick={handleOpenShareModal}>
            Share
          </button>
          {isDirty && (
            <button
              className="btn btn-danger"
              onClick={() => {
                lastFocusedElement.current = document.activeElement as HTMLElement;
                setShowUnsavedChangesModal(true);
              }}
            >
              Discard
            </button>
          )}
        </div>
      </div>

      {(error || priceError) && (
        <div className="error-message">{getUserFriendlyErrorMessage(error || priceError)}</div>
      )}

      {validation?.warnings.map((warning, i) => (
        <div key={i} className="validation-warning">
          {warning.message}
        </div>
      ))}

      <div className="configurator-layout">
        <div className="options-section">
          {product.options.filter((opt) => opt.type !== 'quantity').map(renderOption)}

          {product.options.filter((opt) => opt.type === 'quantity').map(renderOption)}

          {product.addOns.length > 0 && (
            <div className="addons-section">
              <h3 className="addons-title">Add-ons</h3>
              {product.addOns.map(renderAddOn)}
            </div>
          )}
        </div>

        <div className="preview-panel">
          <div className="preview-image-container">
            <img src={previewUrl} alt={`${product.name} preview`} className="preview-image" />
          </div>

          <div className={`price-display ${isPriceLoading ? 'price-loading' : ''}`}>
            <div className="price-label">Total Price</div>
            <div className="price-value">{isPriceLoading ? '...' : formattedTotal}</div>

            {renderPriceBreakdown()}

            <div className="validation-indicator">
              {isValid ? '✓ Configuration validated' : '⏳ Validating…'}
            </div>

            <div className="quick-add-section">
              <button
                className="quick-add-btn"
                onClick={handleQuickAdd}
                disabled={readOnly || !validation?.valid}
              >
                ⚡ Quick Add to Cart
              </button>
            </div>
          </div>

          <button
            className="btn btn-success btn-block"
            onClick={handleAddToCart}
            disabled={readOnly || !validation?.valid || isPriceLoading}
          >
            {isPriceLoading ? 'Calculating...' : 'Add to Cart'}
          </button>

          <div className="config-summary">
            <div className="config-summary-title">Your Configuration</div>
            {product.options
              .filter((opt) => opt.type !== 'quantity' && selections[opt.id])
              .map((opt) => {
                const value = selections[opt.id];
                let displayValue: string = String(value);

                if (opt.choices) {
                  const choice = opt.choices.find((c) => c.value === value);
                  displayValue = choice?.label || String(value);
                }

                return (
                  <div key={opt.id} className="config-summary-item">
                    <span>{opt.name}:</span>
                    <span>{displayValue}</span>
                  </div>
                );
              })}
            <div className="config-summary-item">
              <span>Quantity:</span>
              <span>{quantity}</span>
            </div>
            {selectedAddOns.length > 0 && (
              <div className="config-summary-item">
                <span>Add-ons ({selectedAddOns.length}):</span>
                <span>
                  {selectedAddOns
                    .map((id) => product.addOns.find((a) => a.id === id))
                    .filter((addOn): addOn is AddOn => Boolean(addOn))
                    .map((addOn) => formatPrice(addOn.price, product.currency))
                    .join(' + ')}
                </span>
              </div>
            )}
          </div>

          {lastSaved && (
            <div className="draft-section">
              <div className="draft-header">
                <span className="draft-title">Draft saved</span>
                <span className="draft-saved">Last saved: {lastSaved.toLocaleTimeString()}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {renderDraftModal()}
      {renderShareModal()}
      {renderUnsavedChangesModal()}
    </div>
  );
};

export default ProductConfigurator;
