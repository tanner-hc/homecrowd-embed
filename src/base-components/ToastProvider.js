import * as toastApi from './toastApi.js';

export function ToastProvider() {
  return '';
}

export function useToast() {
  return {
    showToast: toastApi.showToast,
    showError: toastApi.showError,
    showSuccess: toastApi.showSuccess,
    hideToast: toastApi.hideToast,
  };
}
