export function computeTimeLeft(endDate) {
  if (!endDate) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
  }
  var now = new Date().getTime();
  var end = new Date(endDate).getTime();
  var difference = end - now;
  if (difference <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
  }
  return {
    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
    hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((difference % (1000 * 60)) / 1000),
    isExpired: false,
  };
}

export function formatCountdownLine(t) {
  if (t.isExpired) {
    return 'Auction Ended';
  }
  var parts = [];
  if (t.days > 0) {
    parts.push(t.days + 'd');
  }
  if (t.hours > 0) {
    parts.push(t.hours + 'h');
  }
  if (t.minutes > 0) {
    parts.push(t.minutes + 'm');
  }
  if (t.days === 0 && t.hours === 0) {
    parts.push(t.seconds + 's');
  }
  return parts.join(' ');
}

export function formatEndDateShort(dateString) {
  if (!dateString) {
    return 'Date TBD';
  }
  try {
    var date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch (e) {
    return 'Date TBD';
  }
}

export function formatDrawingDate(dateString) {
  if (!dateString) {
    return 'Date TBD';
  }
  try {
    var date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch (e) {
    return 'Date TBD';
  }
}
