import { navigate } from '../router.js';
import headerUrl from '../assets/header.png';
import cardScreenUrl from '../assets/signIn_flow/card_screen.png';
import CurvedLogoCarouselHtml, {
  mountCurvedLogoCarousel,
} from '../base-components/CurvedLogoCarousel.js';
import { escapeAttr } from '../base-components/html.js';

export function renderGetStarted(container) {
  container.innerHTML =
    '<div class="hc-get-started">' +
    '<div class="hc-get-started-top">' +
    '<img src="' +
    escapeAttr(headerUrl) +
    '" alt="Homecrowd" class="hc-get-started-logo" />' +
    '<h1 class="hc-get-started-headline">Turn everyday spending<br />into team support</h1>' +
    '<p class="hc-get-started-subtitle">No extra cost. No donations. Just the purchases<br />you already make.</p>' +
    '</div>' +
    CurvedLogoCarouselHtml() +
    '<div class="hc-get-started-hero">' +
    '<div class="hc-get-started-phone">' +
    '<img src="' +
    escapeAttr(cardScreenUrl) +
    '" alt="" class="hc-get-started-hero-img" />' +
    '<div class="hc-get-started-hero-fade" aria-hidden="true"></div>' +
    '</div>' +
    '</div>' +
    '<div class="hc-get-started-actions">' +
    '<button type="button" id="hc-get-started-primary" class="hc-get-started-btn hc-get-started-btn--primary">Get Started</button>' +
    '<button type="button" id="hc-get-started-login" class="hc-get-started-btn hc-get-started-btn--secondary">Log in</button>' +
    '</div>' +
    '</div>';

  var carouselEl = container.querySelector('#hc-curved-logo-carousel');
  var destroyCarousel = mountCurvedLogoCarousel(carouselEl);

  var primaryBtn = container.querySelector('#hc-get-started-primary');
  var loginBtn = container.querySelector('#hc-get-started-login');

  if (primaryBtn) {
    primaryBtn.addEventListener('click', function () {
      navigate('/find-your-school');
    });
  }
  if (loginBtn) {
    loginBtn.addEventListener('click', function () {
      navigate('/login');
    });
  }

  return function cleanup() {
    if (typeof destroyCarousel === 'function') destroyCarousel();
  };
}
