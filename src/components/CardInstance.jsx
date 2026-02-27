import { useRef } from "react";
import { applySnap, detectSnapTarget } from "../snapEngine";

const CARD_WIDTH_DESKTOP = 130;
const CARD_HEIGHT_DESKTOP = 190;
const CARD_WIDTH_MOBILE = 65;
const CARD_HEIGHT_MOBILE = 95;
const TABLE_TOP_GUTTER = 20;

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

  const getCardDimensions = () => {
    const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 740px)").matches;
    return {
      width: isMobile ? CARD_WIDTH_MOBILE : CARD_WIDTH_DESKTOP,
      height: isMobile ? CARD_HEIGHT_MOBILE : CARD_HEIGHT_DESKTOP
    };
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

    const table = document.querySelector(".table");
    const tableRect = table.getBoundingClientRect();
    const point = getClientPoint(event);
    const { width, height } = getCardDimensions();
    const maxX = Math.max(0, tableRect.width - width);
    const rawX = point.x - tableRect.left - offset.current.x;
    const rawY = point.y - tableRect.top - offset.current.y;
    const newX = clamp(rawX, 0, maxX);
    const newY = Math.max(TABLE_TOP_GUTTER, rawY);
    const movingCard = {
      ...card,
      x: newX,
      y: newY
    };

    const snapTarget = detectSnapTarget(movingCard, game.tableCards, width, height);

    game.setTableCards(prev =>
      prev.map(c => {
        if (c.instanceId === card.instanceId) {
          return { ...c, x: newX, y: newY };
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
      const snapped = applySnap(moving, prev, width, height);

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
      <div className="gc-card">
        <div className="gc-head">
          <div className="gc-title">{card.title}</div>

          {card.subtitle && <div className="gc-subtitle">{card.subtitle}</div>}
        </div>

        {card.image && (
          <div className="gc-art-wrap">
            <img
              className={`gc-art ${card.type === "skill" ? "gc-art--skill" : ""} ${card.type === "quest" ? "gc-art--quest" : ""} ${card.type === "diary" ? "gc-art--diary" : ""}`}
              src={card.image}
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
