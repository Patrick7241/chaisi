import { createContext, useContext, useRef, useState, useCallback } from 'react';

// ── Context ───────────────────────────────────────────────────────────────────
const DialogContext = createContext(null);

// ── Provider ──────────────────────────────────────────────────────────────────
export function DialogProvider({ children }) {
  const [dialogs, setDialogs] = useState([]);
  const idCounter = useRef(0);

  const openDialog = useCallback((config) => {
    return new Promise((resolve) => {
      const id = ++idCounter.current;
      setDialogs(prev => [...prev, { id, config, resolve }]);
    });
  }, []);

  const closeDialog = useCallback((id, value) => {
    setDialogs(prev => {
      const item = prev.find(d => d.id === id);
      if (item) item.resolve(value);
      return prev.filter(d => d.id !== id);
    });
  }, []);

  const confirm = useCallback((msg, opts = {}) => {
    return openDialog({ type: 'confirm', message: msg, ...opts });
  }, [openDialog]);

  const alert = useCallback((msg, opts = {}) => {
    return openDialog({ type: 'alert', message: msg, ...opts });
  }, [openDialog]);

  const prompt = useCallback((msg, opts = {}) => {
    return openDialog({ type: 'prompt', message: msg, ...opts });
  }, [openDialog]);

  const select = useCallback((msg, options, opts = {}) => {
    return openDialog({ type: 'select', message: msg, options, ...opts });
  }, [openDialog]);

  return (
    <DialogContext.Provider value={{ confirm, alert, prompt, select }}>
      {children}
      {dialogs.map(({ id, config }) => (
        <DialogModal key={id} config={config} onClose={(val) => closeDialog(id, val)} />
      ))}
    </DialogContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used inside DialogProvider');
  return ctx;
}

// ── Modal component ───────────────────────────────────────────────────────────
function DialogModal({ config, onClose }) {
  const {
    type,
    title,
    message,
    confirmText = '确定',
    cancelText  = '取消',
    placeholder = '',
    options     = [],
  } = config;

  const [inputVal, setInputVal] = useState('');

  function handleConfirm() {
    if (type === 'prompt') {
      onClose(inputVal.trim() || false);
    } else if (type === 'confirm') {
      onClose(true);
    } else {
      onClose(undefined); // alert
    }
  }

  function handleCancel() {
    if (type === 'confirm') onClose(false);
    else if (type === 'prompt') onClose(false);
    else onClose(undefined);
  }

  function handleSelect(idx) {
    onClose(idx);
  }

  return (
    <div className="dialog-overlay" onClick={e => { if (e.target === e.currentTarget) handleCancel(); }}>
      <div className="dialog-box" role="dialog" aria-modal="true">
        {title && <div className="dialog-title">{title}</div>}
        {message && <div className="dialog-message">{message}</div>}

        {type === 'prompt' && (
          <input
            className="dialog-input"
            type="text"
            placeholder={placeholder}
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleConfirm();
              if (e.key === 'Escape') handleCancel();
            }}
            autoFocus
          />
        )}

        {type === 'select' && (
          <div className="dialog-select-list">
            {options.map((opt, idx) => (
              <button
                key={idx}
                className="dialog-select-item"
                onClick={() => handleSelect(idx)}
              >
                {opt}
              </button>
            ))}
          </div>
        )}

        {type !== 'select' && (
          <div className="dialog-buttons">
            {(type === 'confirm' || type === 'prompt') && (
              <button className="dialog-btn dialog-btn-cancel" onClick={handleCancel}>
                {cancelText}
              </button>
            )}
            <button className="dialog-btn dialog-btn-confirm" onClick={handleConfirm} autoFocus={type !== 'prompt'}>
              {confirmText}
            </button>
          </div>
        )}

        {type === 'select' && (
          <div className="dialog-buttons">
            <button className="dialog-btn dialog-btn-cancel" onClick={() => onClose(false)}>
              {cancelText}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
