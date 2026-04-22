import * as api from '../api.js';
import { navigate } from '../router.js';
import LoadingSpinner from '../base-components/LoadingSpinner.js';
import ScreenTitle from '../base-components/ScreenTitle.js';
import SearchBar from '../base-components/SearchBar.js';
import FilterList from '../base-components/FilterList.js';
import { escapeHtml, escapeAttr } from '../base-components/html.js';

var contentTypeMapping = {
  interview: 'Interviews',
  content: 'Content',
  announcement: 'Announcements',
};

var contentTypeBadgeMapping = {
  interview: 'Interview',
  content: 'Content',
  announcement: 'Announcement',
};

function pickImage(item) {
  if (item.featured_image) return item.featured_image;
  if (item.images && item.images[0] && item.images[0].image_path) return item.images[0].image_path;
  if (item.videos && item.videos[0] && item.videos[0].thumbnail_path) return item.videos[0].thumbnail_path;
  return '';
}

function matchesSearch(item, searchText) {
  var s = String(searchText || '').trim().toLowerCase();
  if (!s) return true;
  return (
    String(item.title || '').toLowerCase().indexOf(s) >= 0 ||
    String(item.subtitle || '').toLowerCase().indexOf(s) >= 0 ||
    String(item.description || '').toLowerCase().indexOf(s) >= 0
  );
}

function filterContent(allContent, selectedFilter, searchText) {
  var mappedType = null;
  if (selectedFilter) {
    Object.keys(contentTypeMapping).forEach(function (k) {
      if (contentTypeMapping[k] === selectedFilter) mappedType = k;
    });
  }
  var filtered = allContent.filter(function (item) {
    if (mappedType && item.content_type !== mappedType) return false;
    return matchesSearch(item, searchText);
  });
  var featured = null;
  var rest = [];
  filtered.forEach(function (item) {
    if (!featured && item.featured) featured = item;
    else rest.push(item);
  });
  return { featured: featured, rest: rest };
}

function featuredHtml(item) {
  if (!item) return '';
  var image = pickImage(item);
  var badge = contentTypeBadgeMapping[item.content_type] || item.content_type || 'Content';
  var imageBlock = image
    ? '<img src="' + escapeAttr(image) + '" alt="" class="hc-content-featured-img" />'
    : '<div class="hc-content-featured-img hc-content-featured-img--empty"></div>';
  return (
    '<button type="button" class="hc-content-featured" data-content-id="' +
    escapeAttr(item.id) +
    '">' +
    imageBlock +
    '<span class="hc-content-type-badge hc-content-type-badge--overlay">' +
    escapeHtml(badge) +
    '</span>' +
    '<div class="hc-content-featured-overlay"></div>' +
    '<h3 class="hc-content-featured-title hc-content-featured-title--overlay">' +
    escapeHtml(item.title || 'Content') +
    '</h3>' +
    '</button>'
  );
}

function cardHtml(item) {
  var image = pickImage(item);
  var created = '';
  if (item.created_at) {
    try {
      created = new Date(item.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch (_e) {
      created = '';
    }
  }
  var contentType = item.content_type || '';
  var imageBlock = image
    ? '<img src="' + escapeAttr(image) + '" alt="" class="hc-content-card-img" />'
    : '<div class="hc-content-card-img hc-content-card-img--empty"></div>';
  return (
    '<button type="button" class="hc-content-card" data-content-id="' +
    escapeAttr(item.id) +
    '">' +
    '<div class="hc-content-card-image-wrap">' +
    imageBlock +
    '</div>' +
    '<div class="hc-content-card-info">' +
    '<div class="hc-content-card-title">' +
    escapeHtml(item.title || 'Content') +
    '</div>' +
    ((contentType || created)
      ? '<div class="hc-content-card-meta">' +
        (contentType ? '<span class="hc-content-card-type">' + escapeHtml(contentType) + '</span>' : '') +
        (created
          ? '<span class="hc-content-card-date">' +
            (contentType ? '• ' : '') +
            escapeHtml(created) +
            '</span>'
          : '') +
        '</div>'
      : '') +
    '</div>' +
    '</button>'
  );
}

function renderState(container, state) {
  var uniqueTypes = [];
  state.allContent.forEach(function (item) {
    if (item && item.content_type && uniqueTypes.indexOf(item.content_type) === -1) {
      uniqueTypes.push(item.content_type);
    }
  });
  var categories = uniqueTypes.map(function (t) {
    return contentTypeMapping[t] || t;
  });
  var filtered = filterContent(state.allContent, state.selectedFilter, state.searchText);

  var html = '';
  html += '<div class="hc-content-page">';
  html += '<div class="hc-content-fixed">';
  html += ScreenTitle({
    title: 'Exclusive content',
    subtitle: 'Behind-the-scenes access and team interviews',
  });
  html += SearchBar({
    id: 'hc-content-search',
    value: state.searchText,
    placeholder: 'Search',
    className: 'hc-content-search-bar',
  });
  if (categories.length > 1) {
    html += FilterList({
      title: 'Filter by:',
      categories: categories,
      selectedFilter: state.selectedFilter,
      className: 'hc-content-filter-list',
    });
  }
  html += '</div>';

  html += '<div class="hc-content-scroll">';
  if (filtered.featured) {
    html += '<div class="hc-content-featured-wrap">';
    html += featuredHtml(filtered.featured);
    html += '</div>';
  }

  if (filtered.rest.length > 0) {
    html += '<div class="hc-content-more-title">More Content</div>';
    html += '<div class="hc-content-cards-row">';
    filtered.rest.forEach(function (item) {
      html += cardHtml(item);
    });
    html += '</div>';
  }

  if (!filtered.featured && filtered.rest.length === 0) {
    html += '<div class="hc-content-empty">';
    if (String(state.searchText || '').trim()) {
      html += '<div class="hc-content-empty-title">No content matched your search</div>';
      html += '<div class="hc-content-empty-sub">Try different keywords or browse all content</div>';
    } else {
      html += '<div class="hc-content-empty-title">No content available for this school</div>';
      html += '<div class="hc-content-empty-sub">Content will appear here when added by your school</div>';
    }
    html += '</div>';
  }

  html += '</div>';
  html += '</div>';
  container.innerHTML = html;

  var searchEl = document.getElementById('hc-content-search');
  if (searchEl) {
    searchEl.addEventListener('input', function () {
      state.searchText = searchEl.value || '';
      renderState(container, state);
    });
  }

  container.querySelectorAll('.hc-bc-filter-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var label = btn.textContent || '';
      if (state.selectedFilter === label) state.selectedFilter = null;
      else state.selectedFilter = label;
      renderState(container, state);
    });
  });

  container.querySelectorAll('[data-content-id]').forEach(function (el) {
    el.addEventListener('click', async function () {
      var id = el.getAttribute('data-content-id');
      if (!id) return;
      try {
        await api.incrementContentView(id);
      } catch (_e) { }
      navigate('/content/' + encodeURIComponent(id));
    });
  });
}

export function renderContent(container) {
  container.innerHTML = LoadingSpinner({ text: 'Loading content...' });
  api
    .getContent({ status: 'active' })
    .then(function (res) {
      var allContent = (res && res.results) || [];
      var state = {
        allContent: Array.isArray(allContent) ? allContent : [],
        selectedFilter: null,
        searchText: '',
      };
      renderState(container, state);
    })
    .catch(function (err) {
      container.innerHTML =
        '<div class="hc-alert-error">Failed to load content: ' + escapeHtml(err.message || '') + '</div>';
    });
}
