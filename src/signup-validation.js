export function validateFullName(fullName) {
  var value = String(fullName || '').trim();
  if (!value) {
    return { ok: false, message: 'Please enter your full name' };
  }
  if (!/^[a-zA-Z\s]+$/.test(value)) {
    return { ok: false, message: 'Name can only contain letters' };
  }
  var parts = value.split(/\s+/).filter(Boolean);
  if (parts.length < 2) {
    return {
      ok: false,
      message: 'Please enter first and last name separated by a space',
    };
  }
  for (var i = 0; i < parts.length; i += 1) {
    var part = parts[i];
    if (part.length < 2) {
      return { ok: false, message: 'Name must be at least 2 characters' };
    }
    if (!/^[a-zA-Z]+$/.test(part)) {
      return { ok: false, message: 'Name can only contain letters' };
    }
  }
  return { ok: true, data: value };
}

export function validatePassword(password) {
  var value = String(password || '');
  if (value.length < 8) {
    return { ok: false, message: 'Password must be at least 8 characters long' };
  }
  if (value.length > 128) {
    return { ok: false, message: 'Password must be at most 128 characters long' };
  }
  if (!/[A-Z]/.test(value)) {
    return { ok: false, message: 'Password must contain at least one uppercase letter' };
  }
  if (!/[a-z]/.test(value)) {
    return { ok: false, message: 'Password must contain at least one lowercase letter' };
  }
  if (!/[0-9]/.test(value)) {
    return { ok: false, message: 'Password must contain at least one number' };
  }
  return { ok: true, data: value };
}
