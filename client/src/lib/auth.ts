export async function signOut(logout: () => Promise<void>) {
  await logout();
  localStorage.removeItem("mosaic-role-intent");
  localStorage.removeItem("mosaic-role-intent-at");
  sessionStorage.setItem("mosaic-toast", "Signed out successfully");
  window.location.assign("/");
}
