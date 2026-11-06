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
    () => initialConfiguration?.selections || getDefaultSelections(product),
  );

  const [selectedAddOns, setSelectedAddOns] = useState<string[]>(
    () => initialConfiguration?.addOns || [],
  );

  const [quantity, setQuantity] = useState<number>(() => initialConfiguration?.quantity || 1);

  const [configId] = useState<string>(() => initialConfiguration?.id || generateConfigId());

  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [draftName, setDraftName] = useState('');

  const [showDraftModal, setShowDraftModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);

  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [isValid, setIsValid] = useState(false);

  const [previewUrl, setPreviewUrl] = useState<string>(product.imageUrl);

  const [error, setError] = useState<string | null>(null);

  const [shareUrl, setShareUrl] = useState<string>('');

  const containerRef = useRef<HTMLDivElement>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const lastFocusedElement = useRef<HTMLElement | null>(null);

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

  const availableAddOns = useMemo(() => {
    const map = new Map<string, AddOn>();
    for (const addOn of product.addOns) {
      if (isAddOnAvailable(addOn, selections)) {
        map.set(addOn.id, addOn);
      }
    }
    return map;
  }, [product.addOns, selections]);

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
      } catch {}
    };

    validate();

    return () => {
      cancelled = true;
    };
  }, [currentConfig, product]);

  useEffect(() => {
    let cancelled = false;

    const updatePreview = async () => {
      try {
        const preview = await generatePreview(currentConfig, product);
        if (!cancelled) {
          setPreviewUrl(preview.imageUrl);
        }
      } catch {
        setPreviewUrl(product.imageUrl);
      }
    };

    updatePreview();

    return () => {
      cancelled = true;
    };
  }, [currentConfig, product]);

  useEffect(() => {
    if (onConfigurationChange) {
      onConfigurationChange(currentConfig);
    }
    setIsDirty(true);
  }, [selections, selectedAddOns, quantity]);

  useEffect(() => {
    if (showDraftModal) {
      getAllDrafts().then(setDrafts);
    }
  }, [showDraftModal]);

  useEffect(() => {
    if (showShareModal) {
      const encoded = encodeConfigurationToUrl(currentConfig);
      const url = `${window.location.origin}${window.location.pathname}?config=${encoded}`;
      setShareUrl(url);
    }
  }, [showShareModal, currentConfig]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encodedConfig = params.get('config');

    if (encodedConfig) {
      const decoded = decodeConfigurationFromUrl(encodedConfig);
      if (decoded) {
        if (decoded.selections) setSelections(decoded.selections);
        if (decoded.addOns) setSelectedAddOns(decoded.addOns);
        if (decoded.quantity) setQuantity(decoded.quantity);
      }
    }
  }, []);

  // -------------------------------------------------------------------------
  // Event Handlers
  // -------------------------------------------------------------------------

  const handleOptionChange = useCallback(
    (optionId: string, value: string | number | boolean) => {
      setSelections((prev) => ({
        ...prev,
        [optionId]: value,
      }));

      const option = product.options.find((o) => o.id === optionId);
      // Clean up any dependent add-ons whose requirement is no longer met.
      // Toggles are handled in handleAddOnToggle, so we only need to do this for select options.
      if (option && option.type === 'select') {
        const dependentAddOns = product.addOns.filter((a) => a.dependsOn?.optionId === optionId);

        for (const addOn of dependentAddOns) {
          if (addOn.dependsOn && value !== addOn.dependsOn.requiredValue) {
            const index = selectedAddOns.indexOf(addOn.id);
            if (index > -1) {
              selectedAddOns.splice(index, 1);
              setSelectedAddOns(selectedAddOns);
            }
          }
        }
      }
    },
    [product.options, product.addOns, selectedAddOns],
  );

  const handleAddOnToggle = useCallback(
    (addOnId: string) => {
      const addOn = product.addOns.find((a) => a.id === addOnId);
      if (!addOn) return;

      if (!isAddOnAvailable(addOn, selections)) {
        setError(ERROR_CODES.DEPENDENCY_MISSING);
        return;
      }

      setSelectedAddOns((prev) => {
        if (prev.includes(addOnId)) {
          return prev.filter((id) => id !== addOnId);
        } else {
          return [...prev, addOnId];
        }
      });
    },
    [product.addOns, selections],
  );

  const handleQuantityChange = useCallback(
    (newQuantity: number) => {
      const quantityOption = product.options.find((o) => o.type === 'quantity');
      const min = quantityOption?.min ?? 1;
      const max = quantityOption?.max ?? 999;

      const clampedQuantity = Math.max(min, Math.min(max, newQuantity));
      setQuantity(clampedQuantity);
    },
    [product.options],
  );

  const handleSaveDraft = useCallback(async () => {
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
    navigator.clipboard
      .writeText(shareUrl)
      .then(() => {})
      .catch(() => {
        setError(ERROR_CODES.UNKNOWN);
      });
  }, [shareUrl]);

  const handleModalClose = useCallback((modalType: 'draft' | 'share') => {
    if (modalType === 'draft') {
      setShowDraftModal(false);
    } else {
      setShowShareModal(false);
    }

    if (lastFocusedElement.current) {
      lastFocusedElement.current.focus();
    }
  }, []);

  const handleModalKeyDown = useCallback(
    (e: React.KeyboardEvent, modalType: 'draft' | 'share') => {
      if (e.key === 'Escape') {
        handleModalClose(modalType);
      }
    },
    [handleModalClose],
  );

  const handleDiscardChanges = useCallback(() => {
    setSelections(getDefaultSelections(product));
    setSelectedAddOns([]);
    setQuantity(1);
    setIsDirty(false);
  }, [product]);

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
          {option.choices?.map((choice, index) => (
            <div
              key={index}
              className={`color-swatch ${currentValue === choice.value ? 'selected' : ''}`}
              style={{ backgroundColor: choice.colorHex }}
              onClick={() => !readOnly && handleOptionChange(option.id, choice.value)}
              title={choice.label}
              role="radio"
              aria-checked={currentValue === choice.value}
            />
          ))}
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
        key={addOn.name}
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

        {price.optionModifiers.map((mod, i) => {
          const option = product.options.find((o) => o.id === mod.optionId);
          return (
            <div className="price-line" key={i}>
              <span>{option?.name || mod.optionId}</span>
              <span>
                {mod.amount >= 0 ? '+' : ''}
                {formatPrice(mod.amount, product.currency)}
              </span>
            </div>
          );
        })}

        {price.addOnCosts.map((cost, i) => {
          const addOn = product.addOns.find((a) => a.id === cost.addOnId);
          return (
            <div className="price-line" key={i}>
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
      <div
        className="modal-overlay"
        onClick={() => handleModalClose('draft')}
        onKeyDown={(e) => handleModalKeyDown(e, 'draft')}
      >
        <div className="modal" onClick={(e) => e.stopPropagation()}>
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
      <div
        className="modal-overlay"
        onClick={() => handleModalClose('share')}
        onKeyDown={(e) => handleModalKeyDown(e, 'share')}
      >
        <div className="modal" onClick={(e) => e.stopPropagation()}>
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
          <button
            className="btn btn-secondary"
            onClick={() => {
              lastFocusedElement.current = document.activeElement as HTMLElement;
              setShowShareModal(true);
            }}
          >
            Share
          </button>
          {isDirty && (
            <button className="btn btn-danger" onClick={handleDiscardChanges}>
              Discard
            </button>
          )}
        </div>
      </div>

      {(error || priceError) && (
        <div className="error-message">
          <div>Something went wrong. Please try again.</div>
          <div className="error-code">Error: {error || priceError}</div>
        </div>
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
            <div className="price-value">{formattedTotal}</div>

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
                    .map((id) => {
                      const addOn = availableAddOns.get(id)!;
                      return formatPrice(addOn.price, product.currency);
                    })
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
    </div>
  );
};

export default ProductConfigurator;
