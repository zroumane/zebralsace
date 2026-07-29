import { ref } from 'vue'

// État partagé entre SettingsTab (qui le calcule) et AdminView (qui garde les
// sorties : changement d'onglet et navigation) — même rôle que le traqueur de
// modifications de l'éditeur.
export const reglagesModifies = ref(false)
