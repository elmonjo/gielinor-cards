import { useRef } from "react";
import { detectSnapTarget, resolveSnap } from "../snapEngine";
import { cards as allCards } from "../database/cardCatalog";

const CARD_WIDTH_DESKTOP = 130;
const CARD_HEIGHT_DESKTOP = 190;
const CARD_WIDTH_MOBILE = 60;
const CARD_HEIGHT_MOBILE = 88;
const TABLE_TOP_GUTTER = 20;
const MOBILE_LAYOUT_BREAKPOINT = 740;
const EDGE_SCROLL_THRESHOLD = 80;
const EDGE_SCROLL_MAX_STEP = 6;

const clamp = (value, min, max) =>
  Math.min(Math.max(value, min), max);

const getClientPoint = (event) => {
  if (event.touches && event.touches.length > 0) {
    return {
      x: event.touches[0].clientX,
      y: event.touches[0].clientY
    };
  }

  if (event.changedTouches && event.changedTouches.length > 0) {
    return {
      x: event.changedTouches[0].clientX,
      y: event.changedTouches[0].clientY
    };
  }

  return {
    x: event.clientX,
    y: event.clientY
  };
};

export default function CardInstance({ card, game }) {
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  const groupIdsRef = useRef([card.instanceId]);
  const groupStartPositionsRef = useRef(new Map());
  const catalogCard = allCards.find(entry => entry.id === card.id);
  const imageSrc = catalogCard?.image || card.image;

  const getCardDimensions = () => {
    const isMobile =
      typeof window !== "undefined" && window.innerWidth <= MOBILE_LAYOUT_BREAKPOINT;
    return {
      width: isMobile ? CARD_WIDTH_MOBILE : CARD_WIDTH_DESKTOP,
      height: isMobile ? CARD_HEIGHT_MOBILE : CARD_HEIGHT_DESKTOP
    };
  };

  const edgeScrollDelta = (distanceToEdge) => {
    if (distanceToEdge >= EDGE_SCROLL_THRESHOLD) return 0;
    const intensity = (EDGE_SCROLL_THRESHOLD - distanceToEdge) / EDGE_SCROLL_THRESHOLD;
    const eased = intensity * intensity;
    return Math.max(1, Math.round(eased * EDGE_SCROLL_MAX_STEP));
  };

  const autoPanMainAtEdge = (point) => {
    const main = document.querySelector(".main");
    if (!main) return;

    const bounds = main.getBoundingClientRect();
    let deltaX = 0;
    let deltaY = 0;

    if (point.x > bounds.right - EDGE_SCROLL_THRESHOLD) {
      deltaX = edgeScrollDelta(bounds.right - point.x);
    } else if (point.x < bounds.left + EDGE_SCROLL_THRESHOLD) {
      deltaX = -edgeScrollDelta(point.x - bounds.left);
    }

    if (point.y > bounds.bottom - EDGE_SCROLL_THRESHOLD) {
      deltaY = edgeScrollDelta(bounds.bottom - point.y);
    } else if (point.y < bounds.top + EDGE_SCROLL_THRESHOLD) {
      deltaY = -edgeScrollDelta(point.y - bounds.top);
    }

    if (deltaX !== 0) {
      const maxScrollLeft = Math.max(0, main.scrollWidth - main.clientWidth);
      const nextLeft = clamp(main.scrollLeft + deltaX, 0, maxScrollLeft);
      main.scrollLeft = nextLeft;
    }

    if (deltaY !== 0) {
      const maxScrollTop = Math.max(0, main.scrollHeight - main.clientHeight);
      const nextTop = clamp(main.scrollTop + deltaY, 0, maxScrollTop);
      main.scrollTop = nextTop;
    }
  };

  const getConnectedGroupIds = (cardsOnTable, rootId) => {
    const connected = new Set([rootId]);
    const queue = [rootId];

    while (queue.length > 0) {
      const currentId = queue.shift();
      const currentCard = cardsOnTable.find(entry => entry.instanceId === currentId);
      const nextLinkedId = currentCard?.snappedToId;
      if (nextLinkedId && !connected.has(nextLinkedId)) {
        connected.add(nextLinkedId);
        queue.push(nextLinkedId);
      }

      cardsOnTable.forEach(entry => {
        if (entry.snappedToId !== currentId) return;
        if (connected.has(entry.instanceId)) return;
        connected.add(entry.instanceId);
        queue.push(entry.instanceId);
      });
    }

    return [...connected];
  };

  const startDrag = (event) => {
    event.preventDefault();
    dragging.current = true;

    game.bringToFront(card.instanceId);

    const connectedGroupIds = getConnectedGroupIds(game.tableCards, card.instanceId);
    groupIdsRef.current = connectedGroupIds;
    groupStartPositionsRef.current = new Map(
      game.tableCards
        .filter(entry => connectedGroupIds.includes(entry.instanceId))
        .map(entry => [entry.instanceId, { x: entry.x, y: entry.y }])
    );

    const table = document.querySelector(".table");
    const tableRect = table.getBoundingClientRect();
    const point = getClientPoint(event);

    offset.current = {
      x: point.x - tableRect.left - card.x,
      y: point.y - tableRect.top - card.y
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);
  };

  const updateDrag = (event) => {
    if (!dragging.current) return;

    const point = getClientPoint(event);
    autoPanMainAtEdge(point);

    const table = document.querySelector(".table");
    const tableRect = table.getBoundingClientRect();
    const { width, height } = getCardDimensions();
    const maxX = Math.max(0, tableRect.width - width);
    const rawX = point.x - tableRect.left - offset.current.x;
    const rawY = point.y - tableRect.top - offset.current.y;
    const newX = clamp(rawX, 0, maxX);
    const newY = Math.max(TABLE_TOP_GUTTER, rawY);
    const rootStart = groupStartPositionsRef.current.get(card.instanceId) || {
      x: card.x,
      y: card.y
    };
    const deltaX = newX - rootStart.x;
    const deltaY = newY - rootStart.y;
    const groupIds = new Set(groupIdsRef.current);
    const movingCard = { ...card, x: newX, y: newY };
    const externalCards = game.tableCards.filter(entry => !groupIds.has(entry.instanceId));
    const snapTarget = detectSnapTarget(movingCard, externalCards, width, height);

    game.setTableCards(prev =>
      prev.map(c => {
        if (groupIds.has(c.instanceId)) {
          const start = groupStartPositionsRef.current.get(c.instanceId) || {
            x: c.x,
            y: c.y
          };
          const nextCard = {
            ...c,
            x: Math.max(0, start.x + deltaX),
            y: Math.max(TABLE_TOP_GUTTER, start.y + deltaY)
          };
          if (groupIds.size === 1 && c.instanceId === card.instanceId) {
            nextCard.snappedToId = null;
            nextCard.snapEdge = null;
          }
          return nextCard;
        }

        return {
          ...c,
          previewSnap: c.instanceId === snapTarget
        };
      })
    );

    const dropZone = document.getElementById("binder-drop-zone");
    if (dropZone) {
      const rect = dropZone.getBoundingClientRect();

      const hovering =
        point.x >= rect.left &&
        point.x <= rect.right &&
        point.y >= rect.top &&
        point.y <= rect.bottom;

      dropZone.classList.toggle("binder-hover", hovering);
    }
  };

  const finishDrag = (event) => {
    if (!dragging.current) return;
    dragging.current = false;

    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    window.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener("touchend", onTouchEnd);
    window.removeEventListener("touchcancel", onTouchEnd);

    const point = getClientPoint(event);

    game.setTableCards(prev => {
      const moving = prev.find(c => c.instanceId === card.instanceId);
      if (!moving) return prev;

      const { width, height } = getCardDimensions();
      const groupIds = new Set(groupIdsRef.current);
      const externalCards = prev.filter(entry => !groupIds.has(entry.instanceId));
      const snap = resolveSnap(moving, externalCards, width, height);
      const deltaX = snap ? snap.x - moving.x : 0;
      const deltaY = snap ? snap.y - moving.y : 0;

      return prev.map(c => {
        if (!groupIds.has(c.instanceId)) {
          return { ...c, previewSnap: false };
        }

        const nextCard = {
          ...c,
          x: c.x + deltaX,
          y: c.y + deltaY,
          previewSnap: false
        };

        if (groupIds.size === 1 && c.instanceId === card.instanceId) {
          if (snap) {
            nextCard.snappedToId = snap.targetId;
            nextCard.snapEdge = snap.edge;
          } else {
            nextCard.snappedToId = null;
            nextCard.snapEdge = null;
          }
        }

        return nextCard;
      });
    });

    const dropZone = document.getElementById("binder-drop-zone");
    if (dropZone) {
      const rect = dropZone.getBoundingClientRect();

      const releasedInside =
        point.x >= rect.left &&
        point.x <= rect.right &&
        point.y >= rect.top &&
        point.y <= rect.bottom;

      dropZone.classList.remove("binder-hover");

      if (releasedInside) {
        game.depositToBinder(card.instanceId);
      }
    }
  };

  const onMouseMove = (event) => {
    updateDrag(event);
  };

  const onMouseUp = (event) => {
    finishDrag(event);
  };

  const onTouchMove = (event) => {
    event.preventDefault();
    updateDrag(event);
  };

  const onTouchEnd = (event) => {
    finishDrag(event);
  };

  return (
    <div
      className={`card-instance ${card.previewSnap ? "preview" : ""} ${dragging.current ? "dragging" : ""}`}
      onMouseDown={startDrag}
      onTouchStart={startDrag}
      style={{
        left: card.x,
        top: card.y,
        zIndex: card.zIndex
      }}
    >
      <div className="gc-card">
        <div className="gc-head">
          <div className="gc-title">{card.title}</div>

          {card.subtitle && <div className="gc-subtitle">{card.subtitle}</div>}
        </div>

        {imageSrc && (
          <div className="gc-art-wrap">
            <img
              className={`gc-art ${card.type === "skill" ? "gc-art--skill" : ""} ${card.type === "quest" ? "gc-art--quest" : ""} ${card.type === "diary" ? "gc-art--diary" : ""}`}
              src={imageSrc}
              alt={card.title}
              draggable="false"
              onError={(event) => {
                if (event.currentTarget.src.endsWith("/card-images/quest_icon.png")) return;
                event.currentTarget.src = "/card-images/quest_icon.png";
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
