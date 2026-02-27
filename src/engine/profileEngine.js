const STORAGE_KEY = "gielinor_profiles";

export function getProfiles() {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveProfiles(profiles) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}

export function createProfile(config) {
  const profiles = getProfiles();

  const newProfile = {
    id: Date.now(),
    name: config.name,
    gp: 0,
    gpSpent: 0,
    packsOpened: 0,
    ownedCards: [],
    earnedCards: [],
    enabledCategories: config.enabledCategories,
    unlockRequirement: config.unlockRequirement,
    economyMultiplier: config.economyMultiplier,
    rankCompleted: {},   // NEW
  };

  const updated = [...profiles, newProfile];
  saveProfiles(updated);

  return newProfile;
}

