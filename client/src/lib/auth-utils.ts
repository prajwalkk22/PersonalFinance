export function isUnauthorizedError(error: Error): boolean {
  return /^401: .*Unauthorized/.test(error.message);
}

export function redirectToLogin() {
  setTimeout(() => {
    window.location.href = "/login";
  }, 500);
}
