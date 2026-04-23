import * as api from '../api.js';
import { navigate } from '../router.js';
import LoadingSpinner from '../base-components/LoadingSpinner.js';
import NavHeader from '../base-components/NavHeader.js';
import { escapeHtml, escapeAttr } from '../base-components/html.js';

function pickVideoUrl(item) {
  if (!item) return '';
  if (item.video_url && String(item.video_url).trim()) return String(item.video_url).trim();
  if (item.videos && item.videos[0] && item.videos[0].video_path) return String(item.videos[0].video_path);
  return '';
}

function normalizeVideoUrl(url) {
  if (!url) return '';
  var s = String(url).trim();
  if (s.indexOf('s3://app.gethomecrowd.com/') === 0) {
    return s.replace('s3://app.gethomecrowd.com/', 'https://app.gethomecrowd.com/');
  }
  return s;
}

function isYouTubeUrl(url) {
  if (!url) return false;
  return url.indexOf('youtube.com/watch') >= 0 || url.indexOf('youtu.be/') >= 0;
}

function getYouTubeVideoId(url) {
  if (!url) return '';
  try {
    if (url.indexOf('youtube.com/watch') >= 0) {
      var query = url.split('?')[1] || '';
      var params = new URLSearchParams(query);
      return params.get('v') || '';
    }
    if (url.indexOf('youtu.be/') >= 0) {
      return (url.split('youtu.be/')[1] || '').split('?')[0];
    }
  } catch (_e) { }
  return '';
}

function pickImage(item) {
  if (!item) return '';
  if (item.featured_image) return item.featured_image;
  if (item.images && item.images[0] && item.images[0].image_path) return item.images[0].image_path;
  if (item.videos && item.videos[0] && item.videos[0].thumbnail_path) return item.videos[0].thumbnail_path;
  return '';
}

function typeLabel(contentType) {
  var m = {
    interview: 'Interview',
    content: 'Content',
    announcement: 'Announcement',
  };
  return m[contentType] || contentType || 'Content';
}

function formatDate(dateString) {
  if (!dateString) return '';
  var d = new Date(dateString);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function renderContentDetail(container, contentId) {
  container.innerHTML = LoadingSpinner({ text: 'Loading content...' });
  api
    .getContentItem(contentId)
    .then(function (item) {
      var image = pickImage(item);
      var videoUrl = normalizeVideoUrl(pickVideoUrl(item));
      var isYoutube = isYouTubeUrl(videoUrl);
      var youtubeId = isYoutube ? getYouTubeVideoId(videoUrl) : '';
      var html = '';
      html += '<div class="hc-content-detail-page">';
      html += '<div class="hc-account-settings-nav">';
      html += NavHeader({ title: 'Content', backButtonId: 'hc-content-detail-back' });
      html += '</div>';
      html += '<div class="hc-content-detail-body">';
      if (isYoutube && youtubeId) {
        html +=
          '<div class="hc-content-detail-media">' +
          '<iframe class="hc-content-detail-yt" src="https://www.youtube.com/embed/' +
          escapeAttr(youtubeId) +
          '" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>' +
          '</div>';
      } else if (videoUrl) {
        html +=
          '<div class="hc-content-detail-media">' +
          '<video class="hc-content-detail-video" src="' +
          escapeAttr(videoUrl) +
          '" controls playsinline preload="metadata"></video>' +
          '</div>';
      } else if (image) {
        html +=
          '<div class="hc-content-detail-media"><img src="' +
          escapeAttr(image) +
          '" alt="" class="hc-content-detail-img" /></div>';
      } else {
        html += '<div class="hc-content-detail-media hc-content-detail-media--empty">Check back later for upload</div>';
      }
      html += '<div class="hc-content-detail-type">' + escapeHtml(typeLabel(item.content_type)) + '</div>';
      html += '<h1 class="hc-content-detail-title">' + escapeHtml(item.title || 'Content') + '</h1>';
      if (item.subtitle) {
        html += '<div class="hc-content-detail-subtitle">' + escapeHtml(item.subtitle) + '</div>';
      }
      html += '<div class="hc-content-detail-meta">';
      html += '<span>' + escapeHtml(formatDate(item.created_at)) + '</span>';
      if (item.view_count != null) html += '<span>• ' + escapeHtml(String(item.view_count)) + ' views</span>';
      html += '</div>';
      html += '<div class="hc-content-detail-description">' + escapeHtml(item.description || 'No description available.') + '</div>';
      html += '</div></div>';
      container.innerHTML = html;

      var backBtn = document.getElementById('hc-content-detail-back');
      if (backBtn) backBtn.addEventListener('click', function () { navigate('/content'); });
    })
    .catch(function (err) {
      container.innerHTML =
        '<div class="hc-alert-error">Failed to load content: ' + escapeHtml(err.message || '') + '</div>';
    });
}
