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
const VERTICAL_EDGE_SCROLL_THRESHOLD = 36;
const VERTICAL_EDGE_SCROLL_MAX_STEP = 3;

const clamp = (value, min, max) =>
  Math.min(Math.max(value, min), max);

const collectScrollableAncestors = (element) => {
  const nodes = [];
  let current = element?.parentElement || null;

  while (current) {
    const style = window.getComputedStyle(current);
    const overflowY = style.overflowY;
    const overflowX = style.overflowX;
    const canScrollY =
      (overflowY === "auto" || overflowY === "scroll") &&
      current.scrollHeight > current.clientHeight;
    const canScrollX =
      (overflowX === "auto" || overflowX === "scroll") &&
      current.scrollWidth > current.clientWidth;

    if (canScrollY || canScrollX) {
      nodes.push(current);
    }

    current = current.parentElement;
  }

  return nodes;
};

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

const packGlowClass = (path) => {
  switch (path) {
    case "Novice":
      return "gc-card--pack-novice";
    case "Intermediate":
      return "gc-card--pack-intermediate";
    case "Experienced":
      return "gc-card--pack-experienced";
    case "Master":
      return "gc-card--pack-master";
    case "Grandmaster":
      return "gc-card--pack-grandmaster";
    default:
      return "";
  }
};

export default function CardInstance({ card, game }) {
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  const autoPanPoint = useRef(null);
  const autoPanFrame = useRef(0);
  const catalogCard = allCards.find(entry => entry.id === card.id);
  const imageSrc = catalogCard?.image || card.image;
  const packPath = catalogCard?.path || card.path;

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

  const verticalEdgeScrollDelta = (distanceToEdge) => {
    if (distanceToEdge >= VERTICAL_EDGE_SCROLL_THRESHOLD) return 0;
    const intensity =
      (VERTICAL_EDGE_SCROLL_THRESHOLD - distanceToEdge) / VERTICAL_EDGE_SCROLL_THRESHOLD;
    const eased = intensity * intensity;
    return Math.max(1, Math.round(eased * VERTICAL_EDGE_SCROLL_MAX_STEP));
  };

  const autoPanMainAtEdge = (point) => {
    const main = document.querySelector(".main");
    const table = document.querySelector(".table");
    const scrollContainers = [
      ...new Set([
        main,
        ...collectScrollableAncestors(table),
        document.scrollingElement
      ].filter(Boolean))
    ];
    let deltaX = 0;
    let deltaY = 0;

    if (main) {
      const bounds = main.getBoundingClientRect();

      if (point.x > bounds.right - EDGE_SCROLL_THRESHOLD) {
        deltaX = edgeScrollDelta(bounds.right - point.x);
      } else if (point.x < bounds.left + EDGE_SCROLL_THRESHOLD) {
        deltaX = -edgeScrollDelta(point.x - bounds.left);
      }

    }

    const viewportHeight =
      typeof window !== "undefined" ? window.innerHeight : 0;
    if (viewportHeight > 0) {
      if (point.y > viewportHeight - VERTICAL_EDGE_SCROLL_THRESHOLD) {
        deltaY = verticalEdgeScrollDelta(viewportHeight - point.y);
      } else if (point.y < VERTICAL_EDGE_SCROLL_THRESHOLD) {
        deltaY = -verticalEdgeScrollDelta(point.y);
      }
    }

    scrollContainers.forEach(container => {
      if (deltaX !== 0 && container.scrollWidth > container.clientWidth) {
        const maxScrollLeft = Math.max(0, container.scrollWidth - container.clientWidth);
        container.scrollLeft = clamp(container.scrollLeft + deltaX, 0, maxScrollLeft);
      }

      if (deltaY !== 0 && container.scrollHeight > container.clientHeight) {
        const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
        container.scrollTop = clamp(container.scrollTop + deltaY, 0, maxScrollTop);
      }
    });
  };

  const stopAutoPanLoop = () => {
    autoPanPoint.current = null;
    if (autoPanFrame.current) {
      window.cancelAnimationFrame(autoPanFrame.current);
      autoPanFrame.current = 0;
    }
  };

  const updateDragAtPoint = (point) => {
    const table = document.querySelector(".table");
    if (!table) return;

    const tableRect = table.getBoundingClientRect();
    const { width, height } = getCardDimensions();
    const maxX = Math.max(0, tableRect.width - width);
    const rawX = point.x - tableRect.left - offset.current.x;
    const rawY = point.y - tableRect.top - offset.current.y;
    const newX = clamp(rawX, 0, maxX);
    const newY = Math.max(TABLE_TOP_GUTTER, rawY);
    const movingCard = { ...card, x: newX, y: newY };
    const snapTarget = detectSnapTarget(movingCard, game.tableCards, width, height);

    game.setTableCards(prev =>
      prev.map(c => {
        if (c.instanceId === card.instanceId) {
          return { ...c, x: newX, y: newY, snappedToId: null, snapEdge: null };
        }

        if (c.snappedToId === card.instanceId) {
          return {
            ...c,
            snappedToId: null,
            snapEdge: null,
            previewSnap: c.instanceId === snapTarget
          };
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

  const runAutoPanLoop = () => {
    if (!dragging.current || !autoPanPoint.current) {
      autoPanFrame.current = 0;
      return;
    }

    autoPanMainAtEdge(autoPanPoint.current);
    updateDragAtPoint(autoPanPoint.current);
    autoPanFrame.current = window.requestAnimationFrame(runAutoPanLoop);
  };

  const queueAutoPan = (point) => {
    autoPanPoint.current = point;
    if (!autoPanFrame.current) {
      autoPanFrame.current = window.requestAnimationFrame(runAutoPanLoop);
    }
  };

  const startDrag = (event) => {
    event.preventDefault();
    dragging.current = true;

    game.bringToFront(card.instanceId);
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
    queueAutoPan(point);
    updateDragAtPoint(point);
  };

  const finishDrag = (event) => {
    if (!dragging.current) return;
    dragging.current = false;

    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    window.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener("touchend", onTouchEnd);
    window.removeEventListener("touchcancel", onTouchEnd);
    stopAutoPanLoop();

    const point = getClientPoint(event);

    game.setTableCards(prev => {
      const moving = prev.find(c => c.instanceId === card.instanceId);
      if (!moving) return prev;

      const { width, height } = getCardDimensions();
      const snap = resolveSnap(moving, prev, width, height);
      const snapped = snap
        ? {
            ...moving,
            x: snap.x,
            y: snap.y,
            snappedToId: snap.targetId,
            snapEdge: snap.edge
          }
        : { ...moving, snappedToId: null, snapEdge: null };

      return prev.map(c =>
        c.instanceId === card.instanceId
          ? { ...snapped, previewSnap: false }
          : { ...c, previewSnap: false }
      );
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
      <div className={`gc-card ${packGlowClass(packPath)}`}>
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
