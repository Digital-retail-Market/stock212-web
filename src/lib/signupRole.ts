import type { OnboardingRole } from './onboardingFields';

// Rôle choisi avant l'inscription (ex. bouton « Connexion fournisseur » → /auth?role=seller).
// Gardé en localStorage pour survivre au détour par le lien de confirmation e-mail,
// puis consommé une seule fois par l'onboarding pour présélectionner la carte.
const SIGNUP_ROLE_KEY = 's212_signup_role';

export function rememberSignupRole(role: OnboardingRole) {
  try { localStorage.setItem(SIGNUP_ROLE_KEY, role); } catch { /* mode privé */ }
}

export function takeSignupRole(): OnboardingRole | null {
  try {
    const role = localStorage.getItem(SIGNUP_ROLE_KEY) as OnboardingRole | null;
    localStorage.removeItem(SIGNUP_ROLE_KEY);
    return role;
  } catch {
    return null;
  }
}

// Page à rouvrir après l'onboarding (ex. inscription depuis un lien produit
// partagé). Même stockage que le rôle, pour survivre au lien de confirmation.
const RETURN_PATH_KEY = 's212_signup_return';

export function rememberReturnPath(path: string) {
  try { localStorage.setItem(RETURN_PATH_KEY, path); } catch { /* mode privé */ }
}

export function takeReturnPath(): string | null {
  try {
    const path = localStorage.getItem(RETURN_PATH_KEY);
    localStorage.removeItem(RETURN_PATH_KEY);
    // Chemin interne uniquement (pas de redirection ouverte vers « //autre-site »).
    return path && path.startsWith('/') && !path.startsWith('//') ? path : null;
  } catch {
    return null;
  }
}
