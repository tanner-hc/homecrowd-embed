import * as api from '../api.js';
import { navigate } from '../router.js';
import NavHeader from '../base-components/NavHeader.js';
import MainButton from '../base-components/MainButton.js';
import { showSuccess, showError } from '../base-components/toastApi.js';
import { getSupportContext } from './support.js';

var selectedFile = null;
var previewObjectUrl = null;

var ACCENT = '#1D6DFF';
var NAVY = '#1A2B6B';

function clockIconSvg(size) {
  size = size || 28;
  return (
    '<svg class="hc-upload-receipt-icon" width="' +
    size +
    '" height="' +
    size +
    '" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="9" stroke="' +
    ACCENT +
    '" stroke-width="2"></circle>' +
    '<path d="M12 7v5l3 2" stroke="' +
    ACCENT +
    '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>' +
    '</svg>'
  );
}

function cameraIconSvg(size, color) {
  size = size || 20;
  color = color || ACCENT;
  return (
    '<svg class="hc-upload-receipt-icon" width="' +
    size +
    '" height="' +
    size +
    '" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
    '<path d="M4 8.5V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.5a2 2 0 0 0-2-2h-2.2l-1.2-2H9.4L8.2 6.5H6a2 2 0 0 0-2 2Z" stroke="' +
    color +
    '" stroke-width="1.8" stroke-linejoin="round"></path>' +
    '<circle cx="12" cy="13" r="3.5" stroke="' +
    color +
    '" stroke-width="1.8"></circle>' +
    '</svg>'
  );
}

function galleryIconSvg(size, color) {
  size = size || 20;
  color = color || ACCENT;
  return (
    '<svg class="hc-upload-receipt-icon" width="' +
    size +
    '" height="' +
    size +
    '" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
    '<rect x="4" y="5" width="16" height="14" rx="2" stroke="' +
    color +
    '" stroke-width="1.8"></rect>' +
    '<path d="M8 14l2.5-2.5a1 1 0 0 1 1.4 0L15 14.5" stroke="' +
    color +
    '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path>' +
    '<circle cx="9" cy="10" r="1.2" fill="' +
    color +
    '"></circle>' +
    '</svg>'
  );
}

function receiptIconSvg(size, color) {
  size = size || 32;
  color = color || ACCENT;
  return (
    '<svg class="hc-upload-receipt-icon" width="' +
    size +
    '" height="' +
    size +
    '" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
    '<path d="M7 4h10a2 2 0 0 1 2 2v14l-2-1.5L15 20l-2-1.5L11 20l-2-1.5L7 20V6a2 2 0 0 1 2-2Z" stroke="' +
    color +
    '" stroke-width="1.8" stroke-linejoin="round"></path>' +
    '<path d="M9 9h6M9 12.5h6M9 16h4" stroke="' +
    color +
    '" stroke-width="1.8" stroke-linecap="round"></path>' +
    '</svg>'
  );
}

function setPhotoPanelVisible(el, visible) {
  if (!el) return;
  if (visible) {
    el.classList.remove('is-hidden');
    el.removeAttribute('hidden');
  } else {
    el.classList.add('is-hidden');
    el.setAttribute('hidden', '');
  }
}

function setPreviewMediaVisible(el, visible) {
  setPhotoPanelVisible(el, visible);
}

function revokePreviewUrl() {
  if (previewObjectUrl) {
    URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = null;
  }
}

function isImageFile(file) {
  if (file.type && file.type.indexOf('image/') === 0) return true;
  var name = (file.name || '').toLowerCase();
  return /\.(jpe?g|png|gif|webp|heic|heif)$/.test(name);
}

export function renderUploadReceipt(container) {
  selectedFile = null;
  revokePreviewUrl();

  var html = '';
  html += '<div class="hc-upload-receipt-page">';
  html += '<div class="hc-account-settings-nav">';
  html += NavHeader({
    title: 'Upload Receipt',
    backButtonId: 'hc-upload-receipt-back',
  });
  html += '</div>';
  html += '<div class="hc-upload-receipt-scroll">';

  html += '<div class="hc-upload-receipt-info-card">';
  html += '<div class="hc-upload-receipt-info-icon-wrap">' + clockIconSvg(28) + '</div>';
  html += '<div class="hc-upload-receipt-info-text-wrap">';
  html += '<div class="hc-upload-receipt-info-title">Missing points?</div>';
  html +=
    '<p class="hc-upload-receipt-info-body">If points haven\'t appeared after <strong class="hc-upload-receipt-info-emphasis">24 hours</strong>, upload your receipt and we\'ll review it.</p>';
  html += '</div>';
  html += '</div>';

  html += '<div class="hc-upload-receipt-section">';
  html += '<div class="hc-upload-receipt-section-label">Receipt photo</div>';
  html += '<div class="hc-upload-receipt-photo-area">';

  html += '<div id="hc-upload-receipt-picker" class="hc-upload-receipt-upload-zone">';
  html += '<div class="hc-upload-receipt-upload-icon-circle">' + receiptIconSvg(32) + '</div>';
  html += '<div class="hc-upload-receipt-upload-title">Add a clear photo of your receipt</div>';
  html += '<div class="hc-upload-receipt-upload-hint">Store name, date, and total should be visible</div>';
  html += '<div class="hc-upload-receipt-picker-buttons">';
  html +=
    '<button type="button" class="hc-upload-receipt-picker-primary" id="hc-upload-receipt-camera-btn">';
  html += cameraIconSvg(20, '#ffffff');
  html += '<span>Take photo</span>';
  html += '</button>';
  html +=
    '<button type="button" class="hc-upload-receipt-picker-secondary" id="hc-upload-receipt-library-btn">';
  html += galleryIconSvg(20, '#00C8FF');
  html += '<span>Choose from library</span>';
  html += '</button>';
  html += '</div>';
  html += '</div>';

  html += '<div id="hc-upload-receipt-preview" class="hc-upload-receipt-preview-card is-hidden" hidden>';
  html += '<div class="hc-upload-receipt-preview-media-wrap">';
  html +=
    '<img id="hc-upload-receipt-preview-img" class="hc-upload-receipt-preview-image is-hidden" alt="Receipt preview" hidden />';
  html +=
    '<div id="hc-upload-receipt-preview-file" class="hc-upload-receipt-preview-file is-hidden" hidden></div>';
  html += '<div class="hc-upload-receipt-preview-badge">Ready to submit</div>';
  html += '</div>';
  html += '<div class="hc-upload-receipt-preview-actions">';
  html +=
    '<button type="button" class="hc-upload-receipt-preview-action" id="hc-upload-receipt-retake">';
  html += cameraIconSvg(18);
  html += '<span>Retake</span>';
  html += '</button>';
  html +=
    '<button type="button" class="hc-upload-receipt-preview-action-muted" id="hc-upload-receipt-remove">Remove</button>';
  html += '</div>';
  html += '</div>';
  html += '</div>';

  html += '</div>';

  html += '<div class="hc-upload-receipt-section">';
  html += '<div class="hc-upload-receipt-section-label">Transaction amount</div>';
  html +=
    '<input type="text" id="hc-upload-receipt-amount" class="hc-upload-receipt-input" inputmode="decimal" placeholder="0.00" autocomplete="off" />';
  html += '</div>';

  html += '<div class="hc-upload-receipt-section">';
  html += '<div class="hc-upload-receipt-section-label">Transaction date</div>';
  html +=
    '<input type="date" id="hc-upload-receipt-date" class="hc-upload-receipt-date-input" max="' +
    new Date().toISOString().split('T')[0] +
    '" />';
  html += '</div>';

  html += '<div class="hc-upload-receipt-section">';
  html += '<div class="hc-upload-receipt-section-label">';
  html += 'Additional details <span class="hc-upload-receipt-optional">(optional)</span>';
  html += '</div>';
  html +=
    '<textarea id="hc-upload-receipt-notes" class="hc-upload-receipt-textarea" placeholder="Store name, purchase date, or other details..." rows="4"></textarea>';
  html += '</div>';

  html += '<div class="hc-upload-receipt-actions">';
  html += MainButton({
    id: 'hc-upload-receipt-submit',
    text: 'Submit receipt',
    loadingText: 'Uploading...',
  });
  html += '<div id="hc-upload-receipt-loader" class="hc-upload-receipt-loader" hidden>';
  html += '<span class="hc-bc-main-btn-loader" aria-hidden="true"></span>';
  html += '</div>';
  html += '</div>';

  html +=
    '<input type="file" id="hc-upload-receipt-file" class="hc-upload-receipt-file-input" accept="image/jpeg,image/png,image/heic,image/heif,application/pdf,.jpg,.jpeg,.png,.heic,.heif,.pdf" />';
  html +=
    '<input type="file" id="hc-upload-receipt-camera-file" class="hc-upload-receipt-file-input" accept="image/*" capture="environment" />';

  html += '</div>';
  html += '</div>';

  container.innerHTML = html;

  var backBtn = document.getElementById('hc-upload-receipt-back');
  if (backBtn) {
    backBtn.addEventListener('click', function () {
      navigate('/profile');
    });
  }

  var fileInput = document.getElementById('hc-upload-receipt-file');
  var cameraFileInput = document.getElementById('hc-upload-receipt-camera-file');
  var cameraBtn = document.getElementById('hc-upload-receipt-camera-btn');
  var libraryBtn = document.getElementById('hc-upload-receipt-library-btn');
  var pickerEl = document.getElementById('hc-upload-receipt-picker');
  var previewEl = document.getElementById('hc-upload-receipt-preview');
  var previewImg = document.getElementById('hc-upload-receipt-preview-img');
  var previewFileEl = document.getElementById('hc-upload-receipt-preview-file');
  var retakeBtn = document.getElementById('hc-upload-receipt-retake');
  var removeBtn = document.getElementById('hc-upload-receipt-remove');
  var notesEl = document.getElementById('hc-upload-receipt-notes');
  var amountEl = document.getElementById('hc-upload-receipt-amount');
  var dateEl = document.getElementById('hc-upload-receipt-date');
  var submitBtn = document.getElementById('hc-upload-receipt-submit');
  var loaderEl = document.getElementById('hc-upload-receipt-loader');

  function isTransactionAmountValid() {
    if (!amountEl) return false;
    var value = String(amountEl.value || '').trim();
    if (!value) return false;
    var parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0;
  }

  function isTransactionDateValid() {
    if (!dateEl) return false;
    return /^\d{4}-\d{2}-\d{2}$/.test(String(dateEl.value || '').trim());
  }

  function syncSubmitState() {
    if (!submitBtn) return;
    submitBtn.disabled = !selectedFile || !isTransactionAmountValid() || !isTransactionDateValid();
  }

  function clearPreview() {
    selectedFile = null;
    revokePreviewUrl();
    if (fileInput) fileInput.value = '';
    if (cameraFileInput) cameraFileInput.value = '';
    if (previewImg) {
      previewImg.removeAttribute('src');
      setPreviewMediaVisible(previewImg, false);
    }
    if (previewFileEl) {
      previewFileEl.textContent = '';
      setPreviewMediaVisible(previewFileEl, false);
    }
    setPhotoPanelVisible(previewEl, false);
    setPhotoPanelVisible(pickerEl, true);
    syncSubmitState();
  }

  function showPreview(file) {
    selectedFile = file;
    revokePreviewUrl();
    setPhotoPanelVisible(pickerEl, false);
    setPhotoPanelVisible(previewEl, true);

    if (previewImg && isImageFile(file)) {
      previewObjectUrl = URL.createObjectURL(file);
      previewImg.src = previewObjectUrl;
      setPreviewMediaVisible(previewFileEl, false);
      setPreviewMediaVisible(previewImg, true);
    } else {
      if (previewImg) {
        previewImg.removeAttribute('src');
        setPreviewMediaVisible(previewImg, false);
      }
      if (previewFileEl) {
        previewFileEl.textContent = file.name || 'Selected file';
        setPreviewMediaVisible(previewFileEl, true);
      }
    }

    syncSubmitState();
  }

  function handleFileSelected(file) {
    if (!file) {
      clearPreview();
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showError('File is too large. Maximum size is 10 MB.');
      clearPreview();
      return;
    }
    showPreview(file);
  }

  if (cameraBtn && cameraFileInput) {
    cameraBtn.addEventListener('click', function () {
      cameraFileInput.click();
    });
  }

  if (libraryBtn && fileInput) {
    libraryBtn.addEventListener('click', function () {
      fileInput.click();
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', function () {
      handleFileSelected(fileInput.files && fileInput.files[0]);
    });
  }

  if (cameraFileInput) {
    cameraFileInput.addEventListener('change', function () {
      handleFileSelected(cameraFileInput.files && cameraFileInput.files[0]);
    });
  }

  if (retakeBtn && cameraFileInput) {
    retakeBtn.addEventListener('click', function () {
      cameraFileInput.click();
    });
  }

  if (removeBtn) {
    removeBtn.addEventListener('click', clearPreview);
  }

  if (amountEl) {
    amountEl.addEventListener('input', syncSubmitState);
  }

  if (dateEl) {
    dateEl.addEventListener('change', syncSubmitState);
    dateEl.addEventListener('input', syncSubmitState);
  }

  syncSubmitState();

  if (submitBtn) {
    submitBtn.addEventListener('click', async function () {
      if (!selectedFile) return;
      if (!isTransactionAmountValid()) {
        showError('Enter the transaction amount');
        return;
      }
      if (!isTransactionDateValid()) {
        showError('Select the transaction date');
        return;
      }
      submitBtn.disabled = true;
      var prevHtml = submitBtn.innerHTML;
      submitBtn.innerHTML =
        '<span class="hc-bc-main-btn-loader" aria-hidden="true"></span><span>Uploading...</span>';
      if (loaderEl) loaderEl.hidden = false;
      try {
        await api.uploadReceipt(
          selectedFile,
          notesEl ? notesEl.value : '',
          getSupportContext({ screen: 'Upload Receipt' }),
          amountEl ? amountEl.value : '',
          dateEl ? dateEl.value : ''
        );
        showSuccess('Receipt uploaded');
        if (notesEl) notesEl.value = '';
        if (amountEl) amountEl.value = '';
        if (dateEl) dateEl.value = '';
        clearPreview();
      } catch (err) {
        showError((err && err.message) || 'Failed to upload receipt');
      } finally {
        submitBtn.innerHTML = prevHtml;
        if (loaderEl) loaderEl.hidden = true;
        syncSubmitState();
      }
    });
  }
}
