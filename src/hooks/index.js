import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Debounce a value by delay ms.
 * @param {*} value - Value to debounce
 * @param {number} delay - Delay in ms (default 300)
 * @returns Debounced value
 */
export function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/**
 * Pagination state manager.
 * @param {Object} opts - { initialPage, initialLimit, total }
 */
export function usePagination({ initialPage = 1, initialLimit = 50, total = 0 } = {}) {
  const [page, setPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const hasNext = page < totalPages;
  const hasPrev = page > 1;
  const next = useCallback(() => hasNext && setPage(p => p + 1), [hasNext]);
  const prev = useCallback(() => hasPrev && setPage(p => p - 1), [hasPrev]);
  const goTo = useCallback((p) => setPage(Math.max(1, Math.min(p, totalPages))), [totalPages]);
  const reset = useCallback(() => setPage(1), []);
  return { page, limit, setLimit, totalPages, hasNext, hasPrev, next, prev, goTo, reset, setPage };
}

/**
 * Form state manager with validation and dirty tracking.
 * @param {Object} initialValues - Default field values
 * @param {Object} validators - { fieldName: (value) => errorString | null }
 */
export function useFormState(initialValues = {}, validators = {}) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [dirty, setDirty] = useState(false);

  const setValue = useCallback((field, value) => {
    setValues(prev => ({ ...prev, [field]: value }));
    setDirty(true);
    // Clear field error on change
    setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
  }, []);

  const setMultiple = useCallback((updates) => {
    setValues(prev => ({ ...prev, ...updates }));
    setDirty(true);
  }, []);

  const validate = useCallback(() => {
    const newErrors = {};
    for (const [field, validator] of Object.entries(validators)) {
      const error = validator(values[field], values);
      if (error) newErrors[field] = error;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [values, validators]);

  const reset = useCallback((newValues) => {
    setValues(newValues || initialValues);
    setErrors({});
    setDirty(false);
  }, [initialValues]);

  return { values, errors, dirty, setValue, setMultiple, validate, reset, setValues, setErrors };
}

/**
 * Interval hook — runs callback every `delay` ms.
 * @param {Function} callback
 * @param {number|null} delay - null to pause
 */
export function useInterval(callback, delay) {
  const savedCallback = useRef(callback);
  useEffect(() => { savedCallback.current = callback; }, [callback]);
  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

/**
 * Previous value hook.
 * @param {*} value
 * @returns Previous value
 */
export function usePrevious(value) {
  const ref = useRef();
  useEffect(() => { ref.current = value; }, [value]);
  return ref.current;
}
