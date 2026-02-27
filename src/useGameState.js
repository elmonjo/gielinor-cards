import { useEffect, useMemo, useState } from "react";
import { cards } from "./database/cardCatalog";

const STORAGE_KEY_PREFIX = "gielinor_runtime_profiles_v1";

const PACKS = [
  { name: "Novice", cost: 5000 },
  { name: "Intermediate", cost: 25000 },
  { name: "Experienced", cost: 100000 },
  { name: "Master", cost: 250000 },
  { name: "Grandmaster", cost: 500000 }
];

const LEGACY_PATH_MAP = {
  Adventurer: "Novice",
  Warrior: "Intermediate",
  Champion: "Experienced",
  Warlord: "Master",
  Legend: "Grandmaster"
};

function resolvePackPoolKey(packName, pools) {
  if (Array.isArray(pools?.[packName])) return packName;

  const legacyKey = Object.keys(LEGACY_PATH_MAP).find(
    oldName => LEGACY_PATH_MAP[oldName] === packName
  );

  if (legacyKey && Array.isArray(pools?.[legacyKey])) {
    return legacyKey;
  }

  return packName;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function shuffle(items) {
  return [...items].sort(() => 0.5 - Math.random());
}

function getRuntimeCardSize() {
  if (typeof window === "undefined") {
    return { width: 130, height: 190 };
  }

  const isTouchDevice = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
  return isTouchDevice
    ? { width: 60, height: 88 }
    : { width: 130, height: 190 };
}

function createCardInstances(cardList) {
  const { width: CARD_WIDTH } = getRuntimeCardSize();
  const GAP = 20;
  const viewportWidth =
    typeof window !== "undefined" ? window.innerWidth : 1200;

  const totalWidth =
    cardList.length * CARD_WIDTH +
    (cardList.length - 1) * GAP;

  const startX = (viewportWidth - totalWidth) / 2;

  return cardList.map((card, index) => ({
    ...card,
    instanceId: crypto.randomUUID(),
    x: startX + index * (CARD_WIDTH + GAP),
    y: 260,
    previewSnap: false,
    zIndex: 1
  }));
}

function createBasePackPools() {
  const pools = {};

  PACKS.forEach(pack => {
    pools[pack.name] = cards.filter(c => c.path === pack.name);
  });

  return pools;
}

function normalizePackPools(packPools) {
  if (!packPools || typeof packPools !== "object") {
    return createBasePackPools();
  }

  const normalized = {};

  PACKS.forEach(pack => {
    const current = packPools[pack.name];
    if (Array.isArray(current)) {
      normalized[pack.name] = current;
      return;
    }

    const legacyKey = Object.keys(LEGACY_PATH_MAP).find(
      oldName => LEGACY_PATH_MAP[oldName] === pack.name
    );
    const legacy = legacyKey ? packPools[legacyKey] : null;
    normalized[pack.name] = Array.isArray(legacy) ? legacy : [];
  });

  const fallback = createBasePackPools();
  PACKS.forEach(pack => {
    if (!Array.isArray(normalized[pack.name]) || normalized[pack.name].length === 0) {
      normalized[pack.name] = fallback[pack.name];
    }
  });

  return normalized;
}

function createInitialRunState() {
  const packPools = createBasePackPools();
  const novicePool = shuffle(packPools.Novice);
  const starter = novicePool.slice(0, 5);

  packPools.Novice = packPools.Novice.filter(
    c => !starter.some(s => s.id === c.id)
  );

  return {
    gp: 0,
    tableCards: [],
    binderCards: [],
    packPools,
    zCounter: 1,
    starterRevealState: {
      packName: "Novice Starter Pack",
      options: starter
    }
  };
}

function createProfile(name) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    state: createInitialRunState()
  };
}

function loadProfileSession(storageKey) {
  if (typeof window === "undefined") {
    const fallback = createProfile("Main");
    return {
      profiles: [fallback],
      activeProfileId: fallback.id,
      activeState: fallback.state
    };
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      const fallback = createProfile("Main");
      return {
        profiles: [fallback],
        activeProfileId: fallback.id,
        activeState: fallback.state
      };
    }

    const parsed = JSON.parse(raw);
    const profiles = Array.isArray(parsed?.profiles)
      ? parsed.profiles
      : [];

    if (profiles.length === 0) {
      const fallback = createProfile("Main");
      return {
        profiles: [fallback],
        activeProfileId: fallback.id,
        activeState: fallback.state
      };
    }

    const activeProfileId =
      parsed.activeProfileId || profiles[0].id;

    const activeProfile =
      profiles.find(p => p.id === activeProfileId) || profiles[0];

    return {
      profiles,
      activeProfileId: activeProfile.id,
      activeState: activeProfile.state
    };
  } catch {
    const fallback = createProfile("Main");
    return {
      profiles: [fallback],
      activeProfileId: fallback.id,
      activeState: fallback.state
    };
  }
}

function normalizeImportedProfiles(payload) {
  const importedProfiles = Array.isArray(payload?.profiles)
    ? payload.profiles
    : [];

  const normalizedProfiles = importedProfiles
    .filter(profile => profile && typeof profile === "object")
    .map((profile, index) => ({
      id:
        typeof profile.id === "string" && profile.id.trim()
          ? profile.id
          : `${Date.now()}-import-${index}`,
      name:
        typeof profile.name === "string" && profile.name.trim()
          ? profile.name.trim()
          : `Imported ${index + 1}`,
      state:
        profile.state && typeof profile.state === "object"
          ? clone(profile.state)
          : createInitialRunState()
    }));

  if (normalizedProfiles.length === 0) {
    return null;
  }

  const requestedActiveId =
    typeof payload?.activeProfileId === "string"
      ? payload.activeProfileId
      : normalizedProfiles[0].id;

  const activeProfile =
    normalizedProfiles.find(p => p.id === requestedActiveId) ||
    normalizedProfiles[0];

  return {
    profiles: normalizedProfiles,
    activeProfileId: activeProfile.id,
    activeState: activeProfile.state
  };
}

export function useGameState(storageNamespace = "default") {
  const storageKey = `${STORAGE_KEY_PREFIX}:${storageNamespace}`;
  const session = useMemo(
    () => loadProfileSession(storageKey),
    [storageKey]
  );

  const [profiles, setProfiles] = useState(session.profiles);
  const [activeProfileId, setActiveProfileId] = useState(
    session.activeProfileId
  );

  const [draftState, setDraftState] = useState(null);
  const [starterRevealState, setStarterRevealState] = useState(
    session.activeState.starterRevealState || null
  );
  const [tableCards, setTableCards] = useState(
    session.activeState.tableCards || []
  );
  const [binderCards, setBinderCards] = useState(
    session.activeState.binderCards || []
  );
  const [gp, setGp] = useState(session.activeState.gp || 0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [binderOpen, setBinderOpen] = useState(false);
  const [zCounter, setZCounter] = useState(
    session.activeState.zCounter || 1
  );
  const [packPools, setPackPools] = useState(
    normalizePackPools(session.activeState.packPools)
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const clampCardsToViewport = () => {
      const table = document.querySelector(".table");
      const { width: cardWidth } = getRuntimeCardSize();
      const tableWidth = table?.clientWidth || window.innerWidth;
      const maxX = Math.max(0, tableWidth - cardWidth);

      setTableCards(prev => {
        let changed = false;

        const next = prev.map(card => {
          const clampedX = Math.min(Math.max(card.x ?? 0, 0), maxX);
          const clampedY = Math.max(20, card.y ?? 20);

          if (clampedX !== card.x || clampedY !== card.y) {
            changed = true;
            return {
              ...card,
              x: clampedX,
              y: clampedY
            };
          }

          return card;
        });

        return changed ? next : prev;
      });
    };

    const handleResize = () => {
      window.requestAnimationFrame(clampCardsToViewport);
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, []);

  function hydrateProfileState(state) {
    setDraftState(null);
    setStarterRevealState(state?.starterRevealState || null);
    setMenuOpen(false);
    setBinderOpen(false);
    setGp(state?.gp || 0);
    setTableCards(state?.tableCards || []);
    setBinderCards(state?.binderCards || []);
    setPackPools(normalizePackPools(state?.packPools));
    setZCounter(state?.zCounter || 1);
  }

  function selectProfile(profileId) {
    const selected = profiles.find(p => p.id === profileId);
    if (!selected) return;

    setActiveProfileId(selected.id);
    hydrateProfileState(clone(selected.state));
  }

  function createNewProfile(profileName) {
    const name = profileName?.trim();
    if (!name) return;

    const newProfile = createProfile(name);

    setProfiles(prev => [...prev, newProfile]);
    setActiveProfileId(newProfile.id);
    hydrateProfileState(clone(newProfile.state));
  }

  function deleteProfile(profileId) {
    setProfiles(prev => {
      const exists = prev.some(p => p.id === profileId);
      if (!exists) return prev;

      const remaining = prev.filter(p => p.id !== profileId);

      if (remaining.length === 0) {
        const fallback = createProfile("Main");
        setActiveProfileId(fallback.id);
        hydrateProfileState(clone(fallback.state));
        return [fallback];
      }

      if (activeProfileId === profileId) {
        const next = remaining[0];
        setActiveProfileId(next.id);
        hydrateProfileState(clone(next.state));
      }

      return remaining;
    });
  }

  useEffect(() => {
    if (!activeProfileId) return;

    const runtimeState = {
      gp,
      starterRevealState,
      tableCards,
      binderCards,
      packPools,
      zCounter
    };

    setProfiles(prev =>
      prev.map(profile =>
        profile.id === activeProfileId
          ? { ...profile, state: clone(runtimeState) }
          : profile
      )
    );
  }, [
    gp,
    starterRevealState,
    tableCards,
    binderCards,
    packPools,
    zCounter,
    activeProfileId
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ profiles, activeProfileId })
    );
  }, [profiles, activeProfileId, storageKey]);

  function depositGp(amount) {
    if (!amount || amount <= 0) return;
    setGp(prev => prev + amount);
  }

  function openPack(name) {
    if (draftState || starterRevealState) return;

    const pack = PACKS.find(p => p.name === name);
    if (!pack || gp < pack.cost) return;

    const poolKey = resolvePackPoolKey(name, packPools);
    const pool = packPools[poolKey];
    if (!pool || pool.length === 0) return;

    setGp(prev => prev - pack.cost);

    const shuffled = shuffle(pool);
    const draftSize = Math.min(3, pool.length);
    const draft = shuffled.slice(0, draftSize);

    setDraftState({
      packName: name,
      poolKey,
      options: draft
    });
  }

  function chooseDraftCard(cardId) {
    if (!draftState) return;

    const picked = draftState.options.find(c => c.id === cardId);
    if (!picked) return;

    const poolKey = draftState.poolKey || draftState.packName;
    setPackPools(prev => ({
      ...prev,
      [poolKey]: (prev[poolKey] || []).filter(c => c.id !== picked.id)
    }));

    const nextZ = zCounter + 1;
    setZCounter(nextZ);
    setTableCards(cards => [
      ...cards,
      {
        ...picked,
        instanceId: crypto.randomUUID(),
        x: (window.innerWidth - getRuntimeCardSize().width) / 2,
        y: 260,
        previewSnap: false,
        zIndex: nextZ
      }
    ]);

    setDraftState(null);
  }

  function claimStarterCards() {
    if (!starterRevealState) return;

    const starterInstances = createCardInstances(
      starterRevealState.options
    );
    setTableCards(prev => [...prev, ...starterInstances]);
    setStarterRevealState(null);
  }

  function bringToFront(id) {
    setZCounter(prev => {
      const next = prev + 1;
      setTableCards(cards =>
        cards.map(c =>
          c.instanceId === id ? { ...c, zIndex: next } : c
        )
      );
      return next;
    });
  }

  function depositToBinder(id) {
    const card = tableCards.find(c => c.instanceId === id);
    if (!card) return;

    setTableCards(prev => prev.filter(c => c.instanceId !== id));
    setBinderCards(prev => [...prev, card]);
  }

  function recallFromBinder(id) {
    const card = binderCards.find(c => c.instanceId === id);
    if (!card) return;

    const nextZ = zCounter + 1;
    setZCounter(nextZ);
    setBinderCards(prev => prev.filter(c => c.instanceId !== id));
    setTableCards(prev => [
      ...prev,
      { ...card, x: 400, y: 250, zIndex: nextZ }
    ]);
  }

  function debugResetRun() {
    hydrateProfileState(createInitialRunState());
  }

  function debugRefillPacks() {
    setPackPools(createBasePackPools());
  }

  function debugResetTableLayout() {
    setTableCards(prev => {
      if (!prev.length) return prev;

      const columns = Math.max(
        1,
        Math.floor(((typeof window !== "undefined" ? window.innerWidth : 1200) - 180) / 150)
      );

      return prev.map((card, index) => ({
        ...card,
        x: 140 + (index % columns) * 150,
        y: 260 + Math.floor(index / columns) * 210
      }));
    });
  }

  function debugSpawnCardById(cardId) {
    const id = cardId?.trim();
    if (!id) return false;

    const template = cards.find(c => c.id === id);
    if (!template) return false;

    const nextZ = zCounter + 1;
    setZCounter(nextZ);
    const { width: cardWidth } = getRuntimeCardSize();
    setTableCards(prev => [
      ...prev,
      {
        ...template,
        instanceId: crypto.randomUUID(),
        x: Math.max(0, ((typeof window !== "undefined" ? window.innerWidth : 1200) - cardWidth) / 2),
        y: 260,
        previewSnap: false,
        zIndex: nextZ
      }
    ]);
    return true;
  }

  function exportProfileSession() {
    return {
      exportVersion: 1,
      exportedAt: new Date().toISOString(),
      activeProfileId,
      profiles: clone(profiles)
    };
  }

  function importProfileSession(payload) {
    const normalized = normalizeImportedProfiles(payload);
    if (!normalized) {
      return {
        ok: false,
        message: "Invalid import file (no profiles found)."
      };
    }

    setProfiles(normalized.profiles);
    setActiveProfileId(normalized.activeProfileId);
    hydrateProfileState(normalized.activeState);

    return {
      ok: true,
      message: `Imported ${normalized.profiles.length} profile(s).`
    };
  }

  return {
    tableCards,
    binderCards,
    gp,
    PACKS,
    draftState,
    starterRevealState,
    setDraftState,
    chooseDraftCard,
    claimStarterCards,
    depositGp,
    openPack,
    depositToBinder,
    recallFromBinder,
    bringToFront,
    menuOpen,
    setMenuOpen,
    binderOpen,
    setBinderOpen,
    setTableCards,
    packPools,
    setPackPools,
    profiles,
    activeProfileId,
    selectProfile,
    createNewProfile,
    deleteProfile,
    debugResetRun,
    debugRefillPacks,
    debugResetTableLayout,
    debugSpawnCardById,
    exportProfileSession,
    importProfileSession
  };
}



