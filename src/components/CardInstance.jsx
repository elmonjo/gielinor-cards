import { useRef } from "react";
import { applySnap, detectSnapTarget } from "../snapEngine";

const CARD_WIDTH = 130;
const CARD_HEIGHT = 190;
const TABLE_TOP_GUTTER = 20;

const clamp = (value, min, max) =>
  Math.min(Math.max(value, min), max);

export default function CardInstance({ card, game }) {
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  //Drag Code
  const onMouseDown = (e) => {
    e.preventDefault();
    dragging.current = true;

    game.bringToFront(card.instanceId);

    const table = document.querySelector(".table");
    const tableRect = table.getBoundingClientRect();

    offset.current = {
      x: e.clientX - tableRect.left - card.x,
      y: e.clientY - tableRect.top - card.y
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const onMouseMove = (e) => {
    if (!dragging.current) return;

    const table = document.querySelector(".table");
    const tableRect = table.getBoundingClientRect();
    const maxX = Math.max(0, tableRect.width - CARD_WIDTH);
    const rawX = e.clientX - tableRect.left - offset.current.x;
    const rawY = e.clientY - tableRect.top - offset.current.y;
    const newX = clamp(rawX, 0, maxX);
    const newY = Math.max(TABLE_TOP_GUTTER, rawY);
    const movingCard = {
      ...card,
      x: newX,
      y: newY
    };

    const snapTarget = detectSnapTarget(
      movingCard,
      game.tableCards
    );

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
    //Drag Code

    // Binder hover glow
    const dropZone = document.getElementById("binder-drop-zone");
    if (dropZone) {
      const rect = dropZone.getBoundingClientRect();

      const hovering =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;

      dropZone.classList.toggle("binder-hover", hovering);
    }
  };

const onMouseUp = (e) => {
  dragging.current = false;

  window.removeEventListener("mousemove", onMouseMove);
  window.removeEventListener("mouseup", onMouseUp);

  game.setTableCards(prev => {
  const moving = prev.find(
    c => c.instanceId === card.instanceId
  );
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
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom;

    dropZone.classList.remove("binder-hover");

    if (releasedInside) {
      game.depositToBinder(card.instanceId);
    }
  }
};

return (
<div
  className={`card-instance ${card.previewSnap ? "preview" : ""} ${dragging.current ? "dragging" : ""}`}
    onMouseDown={onMouseDown}
    style={{
      left: card.x,
      top: card.y,
      zIndex: card.zIndex
    }}
  >
    <div className="gc-card">
      <div className="gc-head">
        <div className="gc-title">
          {card.title}
        </div>

        {card.subtitle && (
          <div className="gc-subtitle">
            {card.subtitle}
          </div>
        )}
      </div>

      {card.image && (
        <div className="gc-art-wrap">
          <img
            className={`gc-art ${card.type === "skill" ? "gc-art--skill" : ""} ${card.type === "quest" ? "gc-art--quest" : ""} ${card.type === "diary" ? "gc-art--diary" : ""}`}
            src={card.image}
            alt={card.title}
            draggable="false"
            onError={(e) => {
              if (e.currentTarget.src.endsWith("/card-images/quest_icon.png")) return;
              e.currentTarget.src = "/card-images/quest_icon.png";
            }}
          />
        </div>
      )}

    </div>
  </div>
);
}



