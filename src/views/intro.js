import { navigate } from '../router.js';
import cardImageUrl from '../assets/intro_images/card.png';
import linkCardImageUrl from '../assets/intro_images/link_card.png';
import screenOneImageUrl from '../assets/intro_images/screen_one.png';
import arrowDownImageUrl from '../assets/intro_images/arrow_down.png';
import downloadExtImageUrl from '../assets/intro_images/download_ext.png';
import screenTwoImageUrl from '../assets/intro_images/screen_two.png';
import screenThreeImageUrl from '../assets/intro_images/screen_three.png';

function readRouteQuery(route) {
  var q = String(route || '').indexOf('?');
  if (q < 0) return new URLSearchParams();
  return new URLSearchParams(String(route).slice(q + 1));
}

export function renderIntro(container, route) {
  var params = readRouteQuery(route);
  var fromDashboard = params.get('fromDashboard') === 'true' || params.get('fromDashboard') === '1';
  container.innerHTML =
    '<div class="hc-intro-view">' +
    '<div class="hc-intro-slider-wrap">' +
    '<div id="hc-intro-track" class="hc-intro-track">' +
    '<section class="hc-intro-slide">' +
    '<div class="hc-intro-column hc-intro-column--first">' +
    '<img src="' +
    cardImageUrl +
    '" alt="" class="hc-intro-img hc-intro-img--card" />' +
    '<img src="' +
    linkCardImageUrl +
    '" alt="" class="hc-intro-img hc-intro-img--link-card" />' +
    '<img src="' +
    screenOneImageUrl +
    '" alt="" class="hc-intro-img hc-intro-img--screen-one" />' +
    '</div>' +
    '</section>' +
    '<section class="hc-intro-slide">' +
    '<div class="hc-intro-column hc-intro-column--second">' +
    '<img src="' +
    arrowDownImageUrl +
    '" alt="" class="hc-intro-img hc-intro-img--arrow-down" />' +
    '<img src="' +
    downloadExtImageUrl +
    '" alt="" class="hc-intro-img hc-intro-img--download-ext" />' +
    '<img src="' +
    screenTwoImageUrl +
    '" alt="" class="hc-intro-img hc-intro-img--screen-two" />' +
    '</div>' +
    '</section>' +
    '<section class="hc-intro-slide">' +
    '<div class="hc-intro-column hc-intro-column--third">' +
    '<img src="' +
    screenThreeImageUrl +
    '" alt="" class="hc-intro-img hc-intro-img--screen-three" />' +
    '</div>' +
    '</section>' +
    '</div>' +
    '</div>' +
    '<div class="hc-intro-bottom">' +
    '<div class="hc-intro-dots">' +
    '<span class="hc-intro-dot hc-intro-dot--active" data-index="0"></span>' +
    '<span class="hc-intro-dot" data-index="1"></span>' +
    '<span class="hc-intro-dot" data-index="2"></span>' +
    '</div>' +
    '<button type="button" id="hc-intro-continue" class="hc-intro-btn">Continue</button>' +
    '</div>' +
    '</div>';

  var sliderWrap = container.querySelector('.hc-intro-slider-wrap');
  var track = container.querySelector('#hc-intro-track');
  var dots = Array.prototype.slice.call(container.querySelectorAll('.hc-intro-dot'));
  var continueBtn = container.querySelector('#hc-intro-continue');
  var currentSlide = 0;
  var totalSlides = 3;

  function updateDots() {
    dots.forEach(function (dot, idx) {
      if (idx === currentSlide) {
        dot.classList.add('hc-intro-dot--active');
      } else {
        dot.classList.remove('hc-intro-dot--active');
      }
    });
  }

  function updateSlidePosition(animated) {
    if (!track || !sliderWrap) return;
    var pageWidth = sliderWrap.clientWidth;
    if (animated) {
      track.style.transition = 'transform 250ms ease';
    } else {
      track.style.transition = 'none';
    }
    track.style.transform = 'translateX(' + -currentSlide * pageWidth + 'px)';
    updateDots();
  }

  function handleContinue() {
    if (currentSlide < totalSlides - 1) {
      currentSlide += 1;
      updateSlidePosition(true);
      return;
    }
    navigate(fromDashboard ? '/home' : '/login');
  }

  dots.forEach(function (dot) {
    dot.addEventListener('click', function () {
      var idx = Number(dot.getAttribute('data-index'));
      if (!Number.isFinite(idx)) return;
      currentSlide = Math.max(0, Math.min(totalSlides - 1, idx));
      updateSlidePosition(true);
    });
  });

  continueBtn.addEventListener('click', handleContinue);
  window.addEventListener('resize', function () {
    updateSlidePosition(false);
  });
  updateSlidePosition(false);
}
