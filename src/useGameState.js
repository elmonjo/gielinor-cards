import { useEffect, useMemo, useRef, useState } from "react";
import { cards } from "./database/cardCatalog";

const STORAGE_KEY_PREFIX = "gielinor_runtime_profiles_v1";
const LOCAL_BACKUP_LIMIT = 10;
const TABLE_TOP_GUTTER = 20;
const MOBILE_LAYOUT_BREAKPOINT = 740;

const PACKS = [
  { name: "Novice", cost: 1500 },
  { name: "Intermediate", cost: 10000 },
  { name: "Experienced", cost: 50000 },
  { name: "Master", cost: 100000 },
  { name: "Grandmaster", cost: 200000 }
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
  if (legacyKey && Array.isArray(pools?.[legacyKey])) return legacyKey;
  return packName;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function safeParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function saveLocalBackupSnapshot(storageKey, nextPayloadText) {
  if (typeof window === "undefined") return;
  const previousText = window.localStorage.getItem(storageKey);
  if (!previousText || previousText === nextPayloadText) return;

  const backupKey = `${storageKey}:backup_history`;
  const history = safeParse(window.localStorage.getItem(backupKey), []);
  const previousPayload = safeParse(previousText, null);
  const entry = {
    capturedAt: Date.now(),
    updatedAt: Number(previousPayload?.updatedAt) || 0,
    payload: previousText
  };
  const nextHistory = [entry, ...history].slice(0, LOCAL_BACKUP_LIMIT);
  window.localStorage.setItem(backupKey, JSON.stringify(nextHistory));
}

function shuffle(items) {
  return [...items].sort(() => 0.5 - Math.random());
}

function getRuntimeCardSize() {
  if (typeof window === "undefined") return { width: 130, height: 190 };
  const isMobileLayout = window.innerWidth <= MOBILE_LAYOUT_BREAKPOINT;
  return isMobileLayout ? { width: 60, height: 88 } : { width: 130, height: 190 };
}

function getLayoutBounds() {
  const { width: cardWidth, height: cardHeight } = getRuntimeCardSize();
  if (typeof window === "undefined") {
    return {
      maxX: Math.max(0, 1200 - cardWidth),
      maxY: Math.max(TABLE_TOP_GUTTER, 700 - cardHeight - 20)
    };
  }

  const table = document.querySelector(".table");
  const tableWidth = table?.clientWidth || window.innerWidth;
  const tableHeight = table?.clientHeight || Math.max(window.innerHeight, 700);
  return {
    maxX: Math.max(0, tableWidth - cardWidth),
    maxY: Math.max(TABLE_TOP_GUTTER, tableHeight - cardHeight - 20)
  };
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function offsetFromSnapEdge(edge, cardWidth, cardHeight) {
  switch (edge) {
    case "right":
      return { dx: cardWidth, dy: 0 };
    case "left":
      return { dx: -cardWidth, dy: 0 };
    case "bottom":
      return { dx: 0, dy: cardHeight };
    case "top":
      return { dx: 0, dy: -cardHeight };
    default:
      return { dx: 0, dy: 0 };
  }
}

function applySnapLinks(cardList) {
  const next = (cardList || []).map(card => ({ ...card }));
  if (!next.length) return next;

  const { width: cardWidth, height: cardHeight } = getRuntimeCardSize();
  const indexById = new Map(next.map((card, index) => [card.instanceId, index]));

  for (let pass = 0; pass < next.length; pass += 1) {
    let changed = false;

    next.forEach(card => {
      if (!card?.snappedToId || !card?.snapEdge) return;
      const targetIndex = indexById.get(card.snappedToId);
      if (targetIndex == null) {
        card.snappedToId = null;
        card.snapEdge = null;
        changed = true;
        return;
      }
      const target = next[targetIndex];
      const offset = offsetFromSnapEdge(card.snapEdge, cardWidth, cardHeight);
      const nextX = Math.max(target.x + offset.dx, 0);
      const nextY = Math.max(target.y + offset.dy, TABLE_TOP_GUTTER);
      if (card.x !== nextX || card.y !== nextY) {
        card.x = nextX;
        card.y = nextY;
        changed = true;
      }
    });

    if (!changed) break;
  }

  return next;
}

function inferLegacySnapLinks(cardList) {
  const next = (cardList || []).map(card => ({ ...card }));
  if (!next.length) return next;
  const hasAnyLinks = next.some(card => card?.snappedToId && card?.snapEdge);
  if (hasAnyLinks) return next;

  const { width: cardWidth, height: cardHeight } = getRuntimeCardSize();
  const tolerance = 2;

  next.forEach((card, index) => {
    const candidates = next.filter((_, candidateIndex) => candidateIndex !== index);
    const target = candidates.find(other => {
      const dx = (card.x ?? 0) - (other.x ?? 0);
      const dy = (card.y ?? 0) - (other.y ?? 0);
      const sameRow = Math.abs(dy) <= tolerance;
      const sameCol = Math.abs(dx) <= tolerance;
      return (
        (sameRow && Math.abs(dx - cardWidth) <= tolerance) ||
        (sameRow && Math.abs(dx + cardWidth) <= tolerance) ||
        (sameCol && Math.abs(dy - cardHeight) <= tolerance) ||
        (sameCol && Math.abs(dy + cardHeight) <= tolerance)
      );
    });

    if (!target) return;

    const dx = (card.x ?? 0) - (target.x ?? 0);
    const dy = (card.y ?? 0) - (target.y ?? 0);
    if (Math.abs(dy) <= tolerance && Math.abs(dx - cardWidth) <= tolerance) {
      card.snappedToId = target.instanceId;
      card.snapEdge = "right";
      return;
    }
    if (Math.abs(dy) <= tolerance && Math.abs(dx + cardWidth) <= tolerance) {
      card.snappedToId = target.instanceId;
      card.snapEdge = "left";
      return;
    }
    if (Math.abs(dx) <= tolerance && Math.abs(dy - cardHeight) <= tolerance) {
      card.snappedToId = target.instanceId;
      card.snapEdge = "bottom";
      return;
    }
    if (Math.abs(dx) <= tolerance && Math.abs(dy + cardHeight) <= tolerance) {
      card.snappedToId = target.instanceId;
      card.snapEdge = "top";
    }
  });

  return next;
}

function normalizeTableCardsForSave(cardList) {
  return (cardList || []).map(card => {
    const rawX = Number(card?.x);
    const rawY = Number(card?.y);
    const nextX = Math.max(Number.isFinite(rawX) ? rawX : 0, 0);
    const nextY = Math.max(Number.isFinite(rawY) ? rawY : TABLE_TOP_GUTTER, TABLE_TOP_GUTTER);

    return {
      ...card,
      x: nextX,
      y: nextY
    };
  });
}

function resolveTableCardsFromSave(cardList) {
  const bounds = getLayoutBounds();
  const spanY = Math.max(1, bounds.maxY - TABLE_TOP_GUTTER);
  const rawCards = cardList || [];

  const normalized = rawCards.map(card => {
    const savedXRatio = Number(card?.xRatio);
    const savedYRatio = Number(card?.yRatio);
    const rawX = Number(card?.x);
    const rawY = Number(card?.y);
    const hasRaw = Number.isFinite(rawX) && Number.isFinite(rawY);
    const hasRatios = !hasRaw && Number.isFinite(savedXRatio) && Number.isFinite(savedYRatio);

    const xRatio = hasRatios ? clamp01(savedXRatio) : 0;
    const yRatio = hasRatios ? clamp01(savedYRatio) : 0;

    return {
      ...card,
      x: hasRaw ? Math.max(rawX, 0) : bounds.maxX * xRatio,
      y: hasRaw ? Math.max(rawY, TABLE_TOP_GUTTER) : TABLE_TOP_GUTTER + spanY * yRatio
    };
  });

  const withInferredLinks = inferLegacySnapLinks(normalized);
  return applySnapLinks(withInferredLinks);
}

function createCardInstances(cardList) {
  const { width: cardWidth } = getRuntimeCardSize();
  const gap = 20;
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1200;
  const totalWidth = cardList.length * cardWidth + (cardList.length - 1) * gap;
  const startX = (viewportWidth - totalWidth) / 2;

  return cardList.map((card, index) => ({
    ...card,
    instanceId: crypto.randomUUID(),
    x: startX + index * (cardWidth + gap),
    y: 260,
    snappedToId: null,
    snapEdge: null,
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
  const guaranteedStarterIds = [
    "ironman_armour_set",
    "training_sword",
    "training_shield",
    "training_bow"
  ];

  const guaranteedStarters = guaranteedStarterIds
    .map(id => cards.find(card => card.id === id))
    .filter(Boolean);

  const noviceSkills = shuffle(packPools.Novice.filter(card => card.type === "skill"));
  const skillStarter = noviceSkills.slice(0, 3);
  const starterOptions = [...guaranteedStarters, ...skillStarter];

  packPools.Novice = packPools.Novice.filter(
    card =>
      !guaranteedStarters.some(s => s.id === card.id) &&
      !skillStarter.some(s => s.id === card.id)
  );

  return {
    gp: 0,
    tableCards: [],
    binderCards: [],
    packPools,
    zCounter: 1,
    starterRevealState: starterOptions.length > 0
      ? { packName: "Novice Starter Pack", options: starterOptions }
      : null
  };
}

function createProfile(name) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    state: createInitialRunState()
  };
}

function loadProfileSessionFromKeys(storageKeys) {
  if (typeof window === "undefined") {
    const fallback = createProfile("Main");
    return {
      profiles: [fallback],
      activeProfileId: fallback.id,
      activeState: fallback.state,
      updatedAt: 0
    };
  }

  for (const storageKey of storageKeys) {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const profiles = Array.isArray(parsed?.profiles) ? parsed.profiles : [];
      if (!profiles.length) continue;
      const activeProfileId = parsed.activeProfileId || profiles[0].id;
      const activeProfile = profiles.find(p => p.id === activeProfileId) || profiles[0];
      return {
        profiles,
        activeProfileId: activeProfile.id,
        activeState: activeProfile.state,
        updatedAt: Number(parsed?.updatedAt) || 0
      };
    } catch {
      continue;
    }
  }

  const fallback = createProfile("Main");
  return {
    profiles: [fallback],
    activeProfileId: fallback.id,
    activeState: fallback.state,
    updatedAt: 0
  };
}

function normalizeImportedProfiles(payload) {
  const importedProfiles = Array.isArray(payload?.profiles) ? payload.profiles : [];
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

  if (!normalizedProfiles.length) return null;
  const requestedActiveId =
    typeof payload?.activeProfileId === "string"
      ? payload.activeProfileId
      : normalizedProfiles[0].id;
  const activeProfile =
    normalizedProfiles.find(p => p.id === requestedActiveId) || normalizedProfiles[0];
  return {
    profiles: normalizedProfiles,
    activeProfileId: activeProfile.id,
    activeState: activeProfile.state
  };
}

function normalizeCloudConfig(cloud) {
  return {
    enabled: Boolean(cloud?.enabled),
    databaseUrl: cloud?.databaseUrl || "",
    accessToken: cloud?.accessToken || "",
    userId: cloud?.userId || ""
  };
}

function isCloudReadyConfig(cloud) {
  return Boolean(cloud.enabled && cloud.databaseUrl && cloud.accessToken && cloud.userId);
}

function cloudDepKey(cloud) {
  return JSON.stringify([cloud.enabled, cloud.databaseUrl, cloud.accessToken, cloud.userId]);
}

function cloudUrl(cloud) {
  return `${cloud.databaseUrl.replace(/\/$/, "")}/user_game_state/${cloud.userId}.json?auth=${encodeURIComponent(cloud.accessToken)}`;
}

async function fetchCloudSession(cloud) {
  try {
    const response = await fetch(cloudUrl(cloud));
    if (!response.ok) {
      return { ok: false, status: response.status, data: null };
    }
    const data = await response.json().catch(() => null);
    return { ok: true, status: response.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

async function saveCloudSession(cloud, payload) {
  await fetch(cloudUrl(cloud), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export function useGameState(options = "default") {
  const normalizedOptions =
    typeof options === "string"
      ? { storageNamespace: options, legacyNamespaces: [], cloud: null }
      : {
          storageNamespace: options?.storageNamespace || "default",
          legacyNamespaces: options?.legacyNamespaces || [],
          cloud: options?.cloud || null
        };

  const storageKey = `${STORAGE_KEY_PREFIX}:${normalizedOptions.storageNamespace}`;
  const legacyStorageKeys = normalizedOptions.legacyNamespaces.map(
    ns => `${STORAGE_KEY_PREFIX}:${ns}`
  );
  const allStorageKeys = [storageKey, ...legacyStorageKeys];
  const cloudConfig = normalizeCloudConfig(normalizedOptions.cloud);
  const cloudEnabled = isCloudReadyConfig(cloudConfig);

  const session = useMemo(
    () => loadProfileSessionFromKeys(allStorageKeys),
    [storageKey, JSON.stringify(legacyStorageKeys)]
  );

  const [profiles, setProfiles] = useState(session.profiles);
  const [activeProfileId, setActiveProfileId] = useState(session.activeProfileId);
  const [draftState, setDraftState] = useState(null);
  const [starterRevealState, setStarterRevealState] = useState(
    session.activeState.starterRevealState || null
  );
  const [tableCards, setTableCards] = useState(
    resolveTableCardsFromSave(session.activeState.tableCards || [])
  );
  const [binderCards, setBinderCards] = useState(session.activeState.binderCards || []);
  const [gp, setGp] = useState(session.activeState.gp || 0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [binderOpen, setBinderOpen] = useState(false);
  const [zCounter, setZCounter] = useState(session.activeState.zCounter || 1);
  const [packPools, setPackPools] = useState(normalizePackPools(session.activeState.packPools));
  const [cloudReady, setCloudReady] = useState(!cloudEnabled);
  const [cloudSyncError, setCloudSyncError] = useState("");
  const [lastCloudSaveAt, setLastCloudSaveAt] = useState(0);
  const [cloudAutosavePulse, setCloudAutosavePulse] = useState(0);
  const lastCloudPayloadRef = useRef("");
  const lastCloudUpdatedAtRef = useRef(0);
  const lastCloudPulseSavedRef = useRef(-1);
  const stateVersionRef = useRef(Number(session.updatedAt) || 0);
  const skipNextVersionBumpRef = useRef(true);
  const hydrationCompleteRef = useRef(false);
  const hasPendingCloudSaveRef = useRef(false);

  function buildCloudPayload() {
    if (stateVersionRef.current <= 0) {
      stateVersionRef.current = Date.now();
    }
    return {
      profiles: clone(profiles),
      activeProfileId,
      updatedAt: stateVersionRef.current
    };
  }

  async function flushCloudSave(options = {}) {
    const force = Boolean(options?.force);
    if (!cloudEnabled || !cloudReady) {
      return { ok: true, skipped: true };
    }
    const payload = buildCloudPayload();
    const payloadText = JSON.stringify(payload);
    if (!force && !hasPendingCloudSaveRef.current) {
      return { ok: true, skipped: true };
    }
    if (payloadText === lastCloudPayloadRef.current) {
      hasPendingCloudSaveRef.current = false;
      return { ok: true, skipped: true };
    }

    try {
      const remoteRead = await fetchCloudSession(cloudConfig);
      if (!remoteRead.ok) {
        const message = "Cloud read failed. Save paused to protect progress.";
        setCloudSyncError(message);
        return { ok: false, message };
      }
      const remoteState = remoteRead.data;
      const remoteUpdatedAt = Number(remoteState?.updatedAt) || 0;
      const localUpdatedAt = Number(payload.updatedAt) || 0;
      if (
        remoteUpdatedAt > 0 &&
        remoteUpdatedAt > lastCloudUpdatedAtRef.current &&
        localUpdatedAt <= remoteUpdatedAt
      ) {
        const message = "Cloud has newer progress. Refresh this device before saving.";
        setCloudSyncError(message);
        return { ok: false, message };
      }

      await saveCloudSession(cloudConfig, payload);
      lastCloudPayloadRef.current = payloadText;
      lastCloudUpdatedAtRef.current = Math.max(remoteUpdatedAt, localUpdatedAt);
      hasPendingCloudSaveRef.current = false;
      setLastCloudSaveAt(Date.now());
      setCloudSyncError("");
      return { ok: true };
    } catch {
      const message = "Cloud sync failed, retrying in background.";
      setCloudSyncError(message);
      return { ok: false, message };
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const remapCardsToViewport = () => {
      setTableCards(prev => {
        if (!prev.length) return prev;
        const remapped = prev.map(card => ({
          ...card,
          x: Math.max(Number(card?.x) || 0, 0),
          y: Math.max(Number(card?.y) || TABLE_TOP_GUTTER, TABLE_TOP_GUTTER)
        }));
        const next = applySnapLinks(remapped);
        const changed = next.some(
          (card, index) =>
            card.x !== prev[index].x ||
            card.y !== prev[index].y ||
            card.snappedToId !== prev[index].snappedToId ||
            card.snapEdge !== prev[index].snapEdge
        );
        return changed ? next : prev;
      });
    };

    const handleResize = () => window.requestAnimationFrame(remapCardsToViewport);
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    remapCardsToViewport();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, []);

  function hydrateProfileState(state, options = {}) {
    if (options?.skipVersionBump) {
      skipNextVersionBumpRef.current = true;
    }
    setDraftState(null);
    setStarterRevealState(state?.starterRevealState || null);
    setMenuOpen(false);
    setBinderOpen(false);
    setGp(state?.gp || 0);
    setTableCards(resolveTableCardsFromSave(state?.tableCards || []));
    setBinderCards(state?.binderCards || []);
    setPackPools(normalizePackPools(state?.packPools));
    setZCounter(state?.zCounter || 1);
  }

  useEffect(() => {
    let canceled = false;
    hydrationCompleteRef.current = false;
    skipNextVersionBumpRef.current = true;
    hasPendingCloudSaveRef.current = false;

    async function hydrateFromCloud() {
      if (!cloudEnabled) {
        hydrationCompleteRef.current = true;
        hasPendingCloudSaveRef.current = true;
        setCloudReady(true);
        return;
      }

      try {
        const remoteRead = await fetchCloudSession(cloudConfig);
        if (canceled) return;
        if (!remoteRead.ok) {
          setCloudSyncError("Cloud sync unavailable. Writes paused to protect progress.");
          return;
        }

        const remoteState = remoteRead.data;
        if (remoteState) {
          const normalized = normalizeImportedProfiles(remoteState);
          if (normalized) {
            setProfiles(normalized.profiles);
            setActiveProfileId(normalized.activeProfileId);
            hydrateProfileState(normalized.activeState, { skipVersionBump: true });
            const remoteUpdatedAt = Number(remoteState.updatedAt) || Date.now();
            stateVersionRef.current = remoteUpdatedAt;
            lastCloudUpdatedAtRef.current = remoteUpdatedAt;
            lastCloudPayloadRef.current = JSON.stringify({
              profiles: clone(normalized.profiles),
              activeProfileId: normalized.activeProfileId,
              updatedAt: remoteUpdatedAt
            });
          } else {
            if (stateVersionRef.current <= 0) {
              stateVersionRef.current = Date.now();
            }
          }
        } else {
          if (stateVersionRef.current <= 0) {
            stateVersionRef.current = Date.now();
          }
        }
        setCloudSyncError("");
      } catch {
        if (!canceled) {
          setCloudSyncError("Cloud sync unavailable. Writes paused to protect progress.");
        }
      } finally {
        if (!canceled) {
          hydrationCompleteRef.current = true;
          setCloudReady(true);
        }
      }
    }

    hydrateFromCloud();
    return () => {
      canceled = true;
    };
  }, [cloudEnabled, cloudDepKey(cloudConfig)]);

  function selectProfile(profileId) {
    const selected = profiles.find(p => p.id === profileId);
    if (!selected) return;
    setActiveProfileId(selected.id);
    hydrateProfileState(clone(selected.state), { skipVersionBump: true });
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
      if (!remaining.length) {
        const fallback = createProfile("Main");
        setActiveProfileId(fallback.id);
        hydrateProfileState(clone(fallback.state), { skipVersionBump: true });
        return [fallback];
      }
      if (activeProfileId === profileId) {
        const next = remaining[0];
        setActiveProfileId(next.id);
        hydrateProfileState(clone(next.state), { skipVersionBump: true });
      }
      return remaining;
    });
  }

  useEffect(() => {
    if (!activeProfileId) return;
    const shouldSkipVersionBump =
      skipNextVersionBumpRef.current || !hydrationCompleteRef.current;
    skipNextVersionBumpRef.current = false;
    if (!shouldSkipVersionBump) {
      stateVersionRef.current = Date.now();
      hasPendingCloudSaveRef.current = true;
    }
    const linkedTableCards = applySnapLinks(tableCards);
    const runtimeState = {
      gp,
      starterRevealState,
      tableCards: normalizeTableCardsForSave(linkedTableCards),
      binderCards,
      packPools,
      zCounter
    };
    setProfiles(prev =>
      prev.map(profile =>
        profile.id === activeProfileId ? { ...profile, state: clone(runtimeState) } : profile
      )
    );
  }, [gp, starterRevealState, tableCards, binderCards, packPools, zCounter, activeProfileId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payloadText = JSON.stringify({
      profiles,
      activeProfileId,
      updatedAt: stateVersionRef.current
    });
    saveLocalBackupSnapshot(storageKey, payloadText);
    window.localStorage.setItem(storageKey, payloadText);
  }, [profiles, activeProfileId, storageKey]);

  useEffect(() => {
    if (!cloudEnabled || !cloudReady) return undefined;
    const interval = setInterval(() => {
      setCloudAutosavePulse(prev => prev + 1);
    }, 2000);
    return () => clearInterval(interval);
  }, [cloudEnabled, cloudReady]);

  useEffect(() => {
    if (!cloudEnabled || !cloudReady) return undefined;
    const handlePageHide = () => {
      flushCloudSave();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        flushCloudSave();
      }
    };
    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [cloudEnabled, cloudReady, profiles, activeProfileId, cloudDepKey(cloudConfig)]);

  useEffect(() => {
    if (!cloudEnabled || !cloudReady) return;
    if (!hasPendingCloudSaveRef.current) return;
    const payload = buildCloudPayload();
    const payloadText = JSON.stringify(payload);
    const isSamePayload = payloadText === lastCloudPayloadRef.current;
    const autosaveAlreadyDoneThisPulse = lastCloudPulseSavedRef.current === cloudAutosavePulse;
    if (isSamePayload && autosaveAlreadyDoneThisPulse) return;

    const timer = setTimeout(async () => {
      const result = await flushCloudSave();
      if (result.ok) {
        lastCloudPulseSavedRef.current = cloudAutosavePulse;
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [cloudEnabled, cloudReady, profiles, activeProfileId, cloudDepKey(cloudConfig), cloudAutosavePulse]);

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

    const ownedIds = new Set([...tableCards, ...binderCards].map(card => card.id));
    const seen = new Set();
    const available = pool.filter(card => {
      if (!card?.id) return false;
      if (ownedIds.has(card.id)) return false;
      if (seen.has(card.id)) return false;
      seen.add(card.id);
      return true;
    });
    if (!available.length) return;

    const shuffled = shuffle(available);
    const draft = shuffled.slice(0, Math.min(3, available.length));
    if (!draft.length) return;

    setGp(prev => prev - pack.cost);
    setDraftState({ packName: name, poolKey, options: draft });
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
    setTableCards(cardsOnTable => [
      ...cardsOnTable,
      {
        ...picked,
        instanceId: crypto.randomUUID(),
        x: (window.innerWidth - getRuntimeCardSize().width) / 2,
        y: 260,
        snappedToId: null,
        snapEdge: null,
        previewSnap: false,
        zIndex: nextZ
      }
    ]);
    setDraftState(null);
  }

  function claimStarterCards() {
    if (!starterRevealState) return;
    setTableCards(prev => [...prev, ...createCardInstances(starterRevealState.options)]);
    setStarterRevealState(null);
  }

  function bringToFront(id) {
    setZCounter(prev => {
      const next = prev + 1;
      setTableCards(cardsOnTable =>
        cardsOnTable.map(c => (c.instanceId === id ? { ...c, zIndex: next } : c))
      );
      return next;
    });
  }

  function depositToBinder(id) {
    const card = tableCards.find(c => c.instanceId === id);
    if (!card) return;
    setTableCards(prev =>
      prev
        .filter(c => c.instanceId !== id)
        .map(c =>
          c.snappedToId === id
            ? { ...c, snappedToId: null, snapEdge: null, previewSnap: false }
            : c
        )
    );
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
      { ...card, x: 400, y: 250, zIndex: nextZ, snappedToId: null, snapEdge: null }
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
        y: 260 + Math.floor(index / columns) * 210,
        snappedToId: null,
        snapEdge: null
      }));
    });
  }

  function debugSpawnCardById(cardId) {
    const id = cardId?.trim();
    if (!id) return false;
    const template = cards.find(c => c.id === id);
    if (!template) return false;
    const alreadyOwned =
      tableCards.some(card => card.id === id) || binderCards.some(card => card.id === id);
    if (alreadyOwned) return false;

    const poolKey = resolvePackPoolKey(template.path, packPools);
    const currentPool = Array.isArray(packPools[poolKey]) ? packPools[poolKey] : [];
    const inPool = currentPool.some(card => card.id === id);
    if (!inPool) return false;

    setPackPools(prev => ({
      ...prev,
      [poolKey]: (prev[poolKey] || []).filter(card => card.id !== id)
    }));

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
        snappedToId: null,
        snapEdge: null,
        previewSnap: false,
        zIndex: nextZ
      }
    ]);
    return true;
  }

  function debugDeleteCardById(cardId) {
    const id = cardId?.trim();
    if (!id) return false;
    const removed = [
      ...tableCards.filter(card => card.id === id),
      ...binderCards.filter(card => card.id === id)
    ];
    const exists = removed.length > 0;
    if (!exists) return false;

    setPackPools(prev => {
      const next = { ...prev };
      const seen = new Set();

      removed.forEach(card => {
        if (!card?.id || seen.has(card.id)) return;
        seen.add(card.id);

        const template = cards.find(c => c.id === card.id) || card;
        const poolKey = resolvePackPoolKey(template.path, next);
        const currentPool = Array.isArray(next[poolKey]) ? next[poolKey] : [];
        const alreadyInPool = currentPool.some(c => c.id === template.id);
        if (!alreadyInPool) {
          next[poolKey] = [...currentPool, template];
        }
      });

      return next;
    });

    setTableCards(prev => {
      const removedIds = new Set(
        prev.filter(card => card.id === id).map(card => card.instanceId)
      );
      return prev
        .filter(card => card.id !== id)
        .map(card =>
          removedIds.has(card.snappedToId)
            ? { ...card, snappedToId: null, snapEdge: null, previewSnap: false }
            : card
        );
    });
    setBinderCards(prev => prev.filter(card => card.id !== id));
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
      return { ok: false, message: "Invalid import file (no profiles found)." };
    }
    setProfiles(normalized.profiles);
    setActiveProfileId(normalized.activeProfileId);
    hydrateProfileState(normalized.activeState);
    return { ok: true, message: `Imported ${normalized.profiles.length} profile(s).` };
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
    debugDeleteCardById,
    exportProfileSession,
    importProfileSession,
    flushCloudSave,
    cloudStatus: {
      enabled: cloudEnabled,
      ready: cloudReady,
      error: cloudSyncError,
      lastSavedAt: lastCloudSaveAt
    }
  };
}
