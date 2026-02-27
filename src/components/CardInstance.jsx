import { useRef } from "react";
import { applySnap, detectSnapTarget } from "../snapEngine";

const CARD_WIDTH = 130;
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
  const activePointerId = useRef(null);

  const onPointerDown = (e) => {
    e.preventDefault();
    dragging.current = true;
    activePointerId.current = e.pointerId;

    game.bringToFront(card.instanceId);

    const table = document.querySelector(".table");
    const tableRect = table.getBoundingClientRect();
    const point = getClientPoint(e);

    offset.current = {
      x: point.x - tableRect.left - card.x,
      y: point.y - tableRect.top - card.y
    };

    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  };

  const onPointerMove = (e) => {
    if (!dragging.current) return;
    if (activePointerId.current !== null && e.pointerId !== activePointerId.current) return;
    e.preventDefault();

    const table = document.querySelector(".table");
    const tableRect = table.getBoundingClientRect();
    const point = getClientPoint(e);
    const maxX = Math.max(0, tableRect.width - CARD_WIDTH);
    const rawX = point.x - tableRect.left - offset.current.x;
    const rawY = point.y - tableRect.top - offset.current.y;
    const newX = clamp(rawX, 0, maxX);
    const newY = Math.max(TABLE_TOP_GUTTER, rawY);
    const movingCard = {
      ...card,
      x: newX,
      y: newY
    };

    const snapTarget = detectSnapTarget(movingCard, game.tableCards);

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

  const onPointerUp = (e) => {
    if (activePointerId.current !== null && e.pointerId !== activePointerId.current) return;

    dragging.current = false;
    activePointerId.current = null;

    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);

    const point = getClientPoint(e);

    game.setTableCards(prev => {
      const moving = prev.find(c => c.instanceId === card.instanceId);
      if (!moving) return prev;

      const snapped = applySnap(moving, prev);

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

  return (
    <div
      className={`card-instance ${card.previewSnap ? "preview" : ""} ${dragging.current ? "dragging" : ""}`}
      onPointerDown={onPointerDown}
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
